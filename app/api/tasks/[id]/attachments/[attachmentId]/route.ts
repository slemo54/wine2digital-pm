import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getTaskAccessFlags } from "@/lib/task-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; attachmentId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const userId = (session.user as any).id as string | undefined;
    const role = ((session.user as any).role as string | undefined) || "member";
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const access = await getTaskAccessFlags(prisma, params.id, userId);
    if (!access) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const canRead = role === "admin" || access.isAssignee || access.isProjectMember;
    if (!canRead) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

    const existing = await prisma.taskAttachment.findUnique({
      where: { id: params.attachmentId },
      select: { id: true, taskId: true, uploadedBy: true, fileName: true, filePath: true },
    });
    if (!existing || existing.taskId !== params.id) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    const isProjectManager = access.projectRole === "owner" || access.projectRole === "manager";
    const isUploader = existing.uploadedBy === userId;
    const canDelete = role === "admin" || isProjectManager || (role === "manager" && access.isProjectMember) || isUploader;
    if (!canDelete) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

    await prisma.taskAttachment.delete({ where: { id: params.attachmentId } });

    await prisma.taskActivity.create({
      data: {
        taskId: params.id,
        actorId: userId,
        type: "task.attachment_deleted",
        metadata: { attachmentId: existing.id, fileName: existing.fileName, filePath: existing.filePath },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting task attachment:", error);
    return NextResponse.json({ error: "Failed to delete attachment" }, { status: 500 });
  }
}

