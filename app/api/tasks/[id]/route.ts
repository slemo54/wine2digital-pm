import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
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

    const task = await prisma.task.findUnique({
      where: { id: params.id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            members: {
              select: {
                userId: true,
                role: true,
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
            },
          },
        },
        assignees: {
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
        },
        _count: { select: { comments: true, attachments: true, subtasks: true } },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const isAssignee = task.assignees.some((a) => a.userId === userId);
    const isProjectMember = task.project?.members?.some((m) => m.userId === userId) || false;

    const canRead = role === "admin" || isAssignee || isProjectMember;
    if (!canRead) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error fetching task:", error);
    return NextResponse.json(
      { error: "Failed to fetch task" },
      { status: 500 }
    );
  }
}

export async function PUT(
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

    const existing = await prisma.task.findUnique({
      where: { id: params.id },
      include: {
        project: { select: { members: { select: { userId: true } } } },
        assignees: { select: { userId: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const isAssignee = existing.assignees.some((a) => a.userId === userId);
    const isProjectMember = existing.project?.members?.some((m) => m.userId === userId) || false;

    const canWrite =
      role === "admin" || (role === "manager" && isProjectMember) || (role === "member" && isAssignee);
    if (!canWrite) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await request.json();
    const {
      status,
      priority,
      dueDate,
      title,
      description,
      tags,
      storyPoints,
      list,
      assigneeIds,
    } = body || {};

    // Member can only update status (classic: assignee updates progress/status)
    if (role === "member") {
      const keys = Object.keys(body || {});
      const allowed = new Set(["status"]);
      const invalid = keys.filter((k) => !allowed.has(k));
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: "Members can only update status", invalid },
          { status: 400 }
        );
      }
    }

    if (assigneeIds && role !== "admin" && role !== "manager") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const normalizedTags =
      Array.isArray(tags) ? JSON.stringify(tags.map(String)) : typeof tags === "string" ? tags : undefined;

    const updated = await prisma.task.update({
      where: { id: params.id },
      data: {
        ...(typeof status === "string" ? { status } : {}),
        ...(typeof priority === "string" ? { priority } : {}),
        ...(typeof title === "string" ? { title } : {}),
        ...(typeof description === "string" ? { description } : {}),
        ...(typeof list === "string" ? { list } : {}),
        ...(typeof storyPoints === "number" ? { storyPoints } : {}),
        ...(typeof dueDate === "string" || dueDate === null
          ? { dueDate: dueDate ? new Date(dueDate) : null }
          : {}),
        ...(typeof normalizedTags === "string" || tags === null
          ? { tags: tags === null ? null : normalizedTags }
          : {}),
        ...(assigneeIds && Array.isArray(assigneeIds)
          ? {
              assignees: {
                deleteMany: {},
                create: assigneeIds.map((uid: string) => ({ userId: uid })),
              },
            }
          : {}),
      },
      include: {
        project: { select: { id: true, name: true } },
        assignees: {
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
        },
      },
    });

    // Activity (best-effort): record changes done via this endpoint
    const changes: Array<{ type: string; metadata: any }> = [];
    if (typeof status === "string" && status !== existing.status) {
      changes.push({ type: "task.status_changed", metadata: { from: existing.status, to: status } });
    }
    if (typeof priority === "string" && priority !== existing.priority) {
      changes.push({ type: "task.priority_changed", metadata: { from: existing.priority, to: priority } });
    }
    if ((typeof dueDate === "string" || dueDate === null) && (existing.dueDate?.toISOString() || null) !== (dueDate ? new Date(dueDate).toISOString() : null)) {
      changes.push({
        type: "task.due_date_changed",
        metadata: { from: existing.dueDate?.toISOString() || null, to: dueDate ? new Date(dueDate).toISOString() : null },
      });
    }
    if (typeof title === "string" && title !== existing.title) {
      changes.push({ type: "task.title_changed", metadata: { from: existing.title, to: title } });
    }
    if (typeof description === "string" && description !== existing.description) {
      changes.push({ type: "task.description_changed", metadata: { from: existing.description, to: description } });
    }
    if (typeof list === "string" && list !== existing.list) {
      changes.push({ type: "task.list_changed", metadata: { from: existing.list, to: list } });
    }
    if (typeof storyPoints === "number" && storyPoints !== existing.storyPoints) {
      changes.push({ type: "task.story_points_changed", metadata: { from: existing.storyPoints, to: storyPoints } });
    }
    if (assigneeIds && Array.isArray(assigneeIds)) {
      const prev = existing.assignees.map((a) => a.userId).sort();
      const next = assigneeIds.map(String).sort();
      if (JSON.stringify(prev) !== JSON.stringify(next)) {
        changes.push({ type: "task.assignees_changed", metadata: { from: prev, to: next } });
      }
    }
    if (typeof normalizedTags === "string" || tags === null) {
      if ((existing.tags || null) !== (tags === null ? null : normalizedTags || null)) {
        changes.push({
          type: "task.tags_changed",
          metadata: { from: existing.tags || null, to: tags === null ? null : normalizedTags || null },
        });
      }
    }

    if (changes.length > 0) {
      await prisma.taskActivity.createMany({
        data: changes.map((c) => ({
          taskId: params.id,
          actorId: userId,
          type: c.type,
          metadata: c.metadata,
        })),
      });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(
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

    const existing = await prisma.task.findUnique({
      where: { id: params.id },
      include: {
        project: { select: { members: { select: { userId: true } } } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const isProjectMember = existing.project?.members?.some((m) => m.userId === userId) || false;

    // Delete: admin always; manager if project member
    const canDelete = role === "admin" || (role === "manager" && isProjectMember);
    if (!canDelete) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    await prisma.task.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
