import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getTaskAccessFlags } from "@/lib/task-access";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const userId = (session.user as any).id as string | undefined;
    const role = ((session.user as any).role as string | undefined) || "member";
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const existing = await prisma.subtaskDependency.findUnique({
      where: { id: params.id },
      select: { id: true, subtaskId: true, dependsOnId: true, subtask: { select: { taskId: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Dependency not found" }, { status: 404 });

    const access = await getTaskAccessFlags(prisma, existing.subtask.taskId, userId);
    if (!access) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const isProjectManager = access.projectRole === "owner" || access.projectRole === "manager";
    const canWrite =
      role === "admin" ||
      isProjectManager ||
      (role === "manager" && access.isProjectMember) ||
      (role === "member" && access.isAssignee);
    if (!canWrite) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

    await prisma.subtaskDependency.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting dependency:", error);
    return NextResponse.json({ error: "Failed to delete dependency" }, { status: 500 });
  }
}
