import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getTaskAccessFlags } from "@/lib/task-access";

import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const canRead = role === "admin" || access.isAssignee || access.isProjectMember;
    if (!canRead) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const subtasks = await prisma.subtask.findMany({
      where: { taskId: params.id },
      orderBy: { position: "asc" },
    });

    return NextResponse.json(subtasks);
  } catch (error) {
    console.error("Error fetching subtasks:", error);
    return NextResponse.json(
      { error: "Failed to fetch subtasks" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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
    const isProjectManager = access.projectRole === "owner" || access.projectRole === "manager";
    const canWrite =
      role === "admin" ||
      isProjectManager ||
      (role === "manager" && access.isProjectMember) ||
      (role === "member" && access.isAssignee);
    if (!canWrite) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { title, description } = await request.json();

    // Get max position
    const maxPosition = await prisma.subtask.aggregate({
      where: { taskId: params.id },
      _max: { position: true },
    });

    const subtask = await prisma.subtask.create({
      data: {
        taskId: params.id,
        title,
        description,
        position: (maxPosition._max.position || 0) + 1,
      },
    });

    await prisma.taskActivity.create({
      data: {
        taskId: params.id,
        actorId: userId,
        type: "task.subtask_added",
        metadata: { subtaskId: subtask.id, title: subtask.title },
      },
    });

    return NextResponse.json(subtask);
  } catch (error) {
    console.error("Error creating subtask:", error);
    return NextResponse.json(
      { error: "Failed to create subtask" },
      { status: 500 }
    );
  }
}
