import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getTaskAccessFlags } from "@/lib/task-access";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PatchBody = {
  content?: string;
};

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; subtaskId: string; commentId: string } }
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
    const isProjectManager = access.projectRole === "owner" || access.projectRole === "manager";

    const existing = await prisma.subtaskComment.findFirst({
      where: {
        id: params.commentId,
        subtaskId: params.subtaskId,
        subtask: { taskId: params.id },
      },
      select: { id: true, subtaskId: true, userId: true },
    });
    if (!existing) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

    const isAuthor = existing.userId === userId;
    const canEdit =
      role === "admin" || isProjectManager || (role === "manager" && access.isProjectMember) || isAuthor;
    if (!canEdit) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

    const body = (await request.json()) as PatchBody;
    const text = typeof body?.content === "string" ? body.content.trim() : "";
    if (!text) return NextResponse.json({ error: "content required" }, { status: 400 });

    const updated = await prisma.subtaskComment.update({
      where: { id: params.commentId },
      data: { content: text },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            firstName: true,
            lastName: true,
            image: true,
          },
        },
      },
    });

    await prisma.taskActivity.create({
      data: {
        taskId: params.id,
        actorId: userId,
        type: "subtask.comment_updated",
        metadata: { subtaskId: params.subtaskId, commentId: updated.id },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating subtask comment:", error);
    return NextResponse.json({ error: "Failed to update comment" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; subtaskId: string; commentId: string } }
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
    const isProjectManager = access.projectRole === "owner" || access.projectRole === "manager";

    const existing = await prisma.subtaskComment.findFirst({
      where: {
        id: params.commentId,
        subtaskId: params.subtaskId,
        subtask: { taskId: params.id },
      },
      select: { id: true, userId: true },
    });
    if (!existing) return NextResponse.json({ error: "Comment not found" }, { status: 404 });

    const isAuthor = existing.userId === userId;
    const canDelete =
      role === "admin" || isProjectManager || (role === "manager" && access.isProjectMember) || isAuthor;
    if (!canDelete) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

    await prisma.subtaskComment.delete({ where: { id: params.commentId } });

    await prisma.taskActivity.create({
      data: {
        taskId: params.id,
        actorId: userId,
        type: "subtask.comment_deleted",
        metadata: { subtaskId: params.subtaskId, commentId: existing.id },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting subtask comment:", error);
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}

