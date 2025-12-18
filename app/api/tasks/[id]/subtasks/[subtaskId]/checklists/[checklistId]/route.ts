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

export async function PUT(
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
      isProjectManager ||
      (role === "manager" && access.isProjectMember) ||
      (role === "member" && access.isAssignee);
    if (!canWrite) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

    const existing = await prisma.subtaskChecklist.findFirst({
      where: { id: params.checklistId, subtaskId: params.subtaskId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: "Checklist not found" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const titleRaw = body?.title;
    const positionRaw = body?.position;

    const data: { title?: string; position?: number } = {};
    if (typeof titleRaw === "string") {
      const title = titleRaw.trim();
      if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
      data.title = title;
    }
    if (typeof positionRaw === "number" && Number.isFinite(positionRaw)) {
      data.position = Math.max(0, Math.floor(positionRaw));
    }
    if (!Object.keys(data).length) return NextResponse.json({ error: "No fields to update" }, { status: 400 });

    const checklist = await prisma.subtaskChecklist.update({
      where: { id: params.checklistId },
      data,
      include: { items: { orderBy: { position: "asc" } } },
    });

    return NextResponse.json({ checklist });
  } catch (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json(
        { error: "SubtaskChecklist table missing. Run Prisma migrations first." },
        { status: 501 }
      );
    }
    console.error("Error updating subtask checklist:", error);
    return NextResponse.json({ error: "Failed to update checklist" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
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
      isProjectManager ||
      (role === "manager" && access.isProjectMember) ||
      (role === "member" && access.isAssignee);
    if (!canWrite) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

    const existing = await prisma.subtaskChecklist.findFirst({
      where: { id: params.checklistId, subtaskId: params.subtaskId },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ error: "Checklist not found" }, { status: 404 });

    await prisma.subtaskChecklist.delete({ where: { id: params.checklistId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isMissingTableError(error)) {
      return NextResponse.json(
        { error: "SubtaskChecklist table missing. Run Prisma migrations first." },
        { status: 501 }
      );
    }
    console.error("Error deleting subtask checklist:", error);
    return NextResponse.json({ error: "Failed to delete checklist" }, { status: 500 });
  }
}


