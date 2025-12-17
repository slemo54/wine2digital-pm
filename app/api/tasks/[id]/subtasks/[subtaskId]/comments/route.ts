import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getTaskAccessFlags } from "@/lib/task-access";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string; subtaskId: string } }
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

    const comments = await prisma.subtaskComment.findMany({
      where: { subtaskId: params.subtaskId },
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
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error("Error fetching subtask comments:", error);
    return NextResponse.json({ error: "Failed to fetch subtask comments" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; subtaskId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const userId = (session.user as any).id as string | undefined;
    const role = ((session.user as any).role as string | undefined) || "member";
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const access = await getTaskAccessFlags(prisma, params.id, userId);
    if (!access) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const canWrite =
      role === "admin" ||
      (role === "manager" && access.isProjectMember) ||
      (role === "member" && access.isAssignee);
    if (!canWrite) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

    const { content } = await request.json();
    const text = typeof content === "string" ? content.trim() : "";
    if (!text) return NextResponse.json({ error: "content required" }, { status: 400 });

    const comment = await prisma.subtaskComment.create({
      data: {
        subtaskId: params.subtaskId,
        userId,
        content: text,
      },
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
        type: "subtask.comment_added",
        metadata: { subtaskId: params.subtaskId, commentId: comment.id },
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Error creating subtask comment:", error);
    return NextResponse.json({ error: "Failed to create subtask comment" }, { status: 500 });
  }
}


