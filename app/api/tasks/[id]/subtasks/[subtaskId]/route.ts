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
    const isProjectManager = access.projectRole === "owner" || access.projectRole === "manager";
    const canWrite =
      role === "admin" ||
      isProjectManager ||
      (role === "manager" && access.isProjectMember) ||
      (role === "member" && access.isAssignee);
    if (!canWrite) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { completed, status, title, description, assigneeId, dueDate, priority } = await request.json();
    const canAssign = role === "admin" || isProjectManager;
    if (assigneeId !== undefined && !canAssign) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Determine target status
    let targetStatus = status;
    if (!targetStatus && typeof completed === "boolean") {
      targetStatus = completed ? "done" : "todo";
    }

    // Dependency Guard
    if (targetStatus === "done") {
      const pendingDependencies = await prisma.subtaskDependency.findFirst({
        where: {
          subtaskId: params.subtaskId,
          dependsOn: {
            status: { not: "done" }
          }
        }
      });

      if (pendingDependencies) {
        return NextResponse.json(
          { error: "Cannot complete subtask. Waiting on dependencies." },
          { status: 409 }
        );
      }
    }

    const subtask = await prisma.subtask.update({
      where: { id: params.subtaskId },
      data: {
        ...(targetStatus && { status: targetStatus, completed: targetStatus === "done" }),
        ...(title && { title }),
        ...(typeof description === "string" || description === null
          ? { description: description === null ? null : String(description) }
          : {}),
        ...(assigneeId !== undefined && { assigneeId }), // allow null to unassign
        ...(dueDate !== undefined && { dueDate }),
        ...(priority && { priority }),
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
        type: "task.subtask_updated",
        metadata: {
          subtaskId: subtask.id,
          status: subtask.status,
          title: subtask.title,
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
    const isProjectManager = access.projectRole === "owner" || access.projectRole === "manager";
    const canDelete = role === "admin" || isProjectManager;
    if (!canDelete) {
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
