import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getTaskAccessFlags } from "@/lib/task-access";
import { prisma } from "@/lib/prisma";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; subtaskId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = (session.user as any).id as string | undefined;
    const role = ((session.user as any).role as string | undefined) || "member";
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const access = await getTaskAccessFlags(prisma, params.id, userId);
    if (!access) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    const canWrite =
      role === "admin" ||
      (role === "manager" && access.isProjectMember) ||
      (role === "member" && access.isAssignee);
    if (!canWrite) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { completed, title, description } = await request.json();

    const subtask = await prisma.subtask.update({
      where: { id: params.subtaskId },
      data: {
        ...(typeof completed === "boolean" && { completed }),
        ...(title && { title }),
        ...(typeof description === "string" || description === null
          ? { description: description === null ? null : String(description) }
          : {}),
      },
    });

    await prisma.taskActivity.create({
      data: {
        taskId: params.id,
        actorId: userId,
        type: "task.subtask_updated",
        metadata: {
          subtaskId: subtask.id,
          ...(typeof completed === "boolean" ? { completed } : {}),
          ...(title ? { title } : {}),
          ...(typeof description === "string" || description === null ? { descriptionUpdated: true } : {}),
        },
      },
    });

    return NextResponse.json(subtask);
  } catch (error) {
    console.error("Error updating subtask:", error);
    return NextResponse.json(
      { error: "Failed to update subtask" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; subtaskId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = (session.user as any).id as string | undefined;
    const role = ((session.user as any).role as string | undefined) || "member";
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const access = await getTaskAccessFlags(prisma, params.id, userId);
    if (!access) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    const canWrite =
      role === "admin" ||
      (role === "manager" && access.isProjectMember) ||
      (role === "member" && access.isAssignee);
    if (!canWrite) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    await prisma.subtask.delete({
      where: { id: params.subtaskId },
    });

    await prisma.taskActivity.create({
      data: {
        taskId: params.id,
        actorId: userId,
        type: "task.subtask_deleted",
        metadata: { subtaskId: params.subtaskId },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting subtask:", error);
    return NextResponse.json(
      { error: "Failed to delete subtask" },
      { status: 500 }
    );
  }
}
