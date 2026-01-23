import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getTaskAccessFlags } from "@/lib/task-access";

export const dynamic = "force-dynamic";

function isMissingTableError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("SubtaskChecklist") && msg.toLowerCase().includes("does not exist");
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; subtaskId: string; checklistId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as any).id as string | undefined;
    const role = ((session.user as any).role as string | undefined) || "member";
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const access = await getTaskAccessFlags(prisma, params.id, userId);
    if (!access) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const isProjectManager = access.projectRole === "owner" || access.projectRole === "manager";
    const subtask = await prisma.subtask.findFirst({
      where: { id: params.subtaskId, taskId: params.id },
      select: { id: true },
    });
    if (!subtask) return NextResponse.json({ error: "Subtask not found" }, { status: 404 });

    const canWrite =
      role === "admin" ||
      isProjectManager;
    if (!canWrite) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

    const checklist = await prisma.subtaskChecklist.findFirst({
      where: { id: params.checklistId, subtaskId: params.subtaskId },
      select: { id: true },
    });
    if (!checklist) return NextResponse.json({ error: "Checklist not found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const content = String(body?.content || "").trim();
    if (!content) return NextResponse.json({ error: "content required" }, { status: 400 });

    const last = await prisma.subtaskChecklistItem.findFirst({
      where: { checklistId: params.checklistId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const position = (last?.position ?? -1) + 1;

    const item = await prisma.subtaskChecklistItem.create({
      data: { checklistId: params.checklistId, content, position },
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json(
        { error: "SubtaskChecklist table missing. Run Prisma migrations first." },
        { status: 501 }
      );
    }
    console.error("Error creating checklist item:", error);
    return NextResponse.json({ error: "Failed to create checklist item" }, { status: 500 });
  }
}


