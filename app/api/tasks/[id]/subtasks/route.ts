import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getTaskAccessFlags } from "@/lib/task-access";

import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const perf = new URL(request.url).searchParams.get("perf") === "1";
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const session = await getServerSession(authOptions);
  const tAuth = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (!session?.user) {
    const headers = perf ? { "Server-Timing": `auth;dur=${(tAuth - t0).toFixed(1)}` } : undefined;
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }

  try {
    const userId = (session.user as any).id as string | undefined;
    const role = ((session.user as any).role as string | undefined) || "member";
    if (!userId) {
      const headers = perf ? { "Server-Timing": `auth;dur=${(tAuth - t0).toFixed(1)}` } : undefined;
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
    }

    const tDb0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    const access = await getTaskAccessFlags(prisma, params.id, userId);
    if (!access) {
      const tDb1 = typeof performance !== "undefined" ? performance.now() : Date.now();
      const headers = perf
        ? { "Server-Timing": `auth;dur=${(tAuth - t0).toFixed(1)},db;dur=${(tDb1 - tDb0).toFixed(1)}` }
        : undefined;
      return NextResponse.json({ error: "Task not found" }, { status: 404, headers });
    }

    const canRead = role === "admin" || access.isAssignee || access.isProjectMember;
    if (!canRead) {
      const tDb1 = typeof performance !== "undefined" ? performance.now() : Date.now();
      const headers = perf
        ? { "Server-Timing": `auth;dur=${(tAuth - t0).toFixed(1)},db;dur=${(tDb1 - tDb0).toFixed(1)}` }
        : undefined;
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers });
    }

    const tQuery0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    const subtasks = await prisma.subtask.findMany({
      where: { taskId: params.id },
      orderBy: { position: "asc" },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            firstName: true,
            lastName: true
          }
        },
        dependencies: true,
        dependentOn: true
      }
    });
    const tQuery1 = typeof performance !== "undefined" ? performance.now() : Date.now();
    const tEnd = typeof performance !== "undefined" ? performance.now() : Date.now();
    const headers = perf
      ? {
          "Server-Timing": `auth;dur=${(tAuth - t0).toFixed(1)},access;dur=${(tQuery0 - tDb0).toFixed(1)},db;dur=${(tQuery1 - tQuery0).toFixed(1)},total;dur=${(tEnd - t0).toFixed(1)}`,
        }
      : undefined;

    return NextResponse.json(subtasks, { headers });
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
      (role === "member" && access.isProjectMember);
    if (!canWrite) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { title, description, assigneeId, dueDate, priority, status } = await request.json();

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
        ...(assigneeId && { assigneeId }),
        ...(dueDate && { dueDate }),
        ...(priority && { priority }),
        ...(status && { status }),
      },
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            firstName: true,
            lastName: true,
          },
        },
        dependencies: true,
        dependentOn: true,
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
