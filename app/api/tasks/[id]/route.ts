import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

const DEFAULT_LIST_NAME = "Untitled list";

function isMissingTableError(err: unknown, table: string): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes(table) && msg.toLowerCase().includes("does not exist");
}

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
        taskList: { select: { id: true, name: true } },
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
        project: { select: { members: { select: { userId: true, role: true } } } },
        assignees: { select: { userId: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const isAssignee = existing.assignees.some((a) => a.userId === userId);
    const membership = existing.project?.members?.find((m) => m.userId === userId) || null;
    const isProjectMember = Boolean(membership);
    const projectRole = membership?.role ? String(membership.role) : "";
    const isProjectManager = projectRole === "owner" || projectRole === "manager";
    const canEditMeta = role === "admin" || isProjectManager || (role === "manager" && isProjectMember);

    const canWrite =
      role === "admin" ||
      isProjectManager ||
      (role === "manager" && isProjectMember) ||
      (role === "member" && isAssignee);
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
      listId,
      assigneeIds,
    } = body || {};

    const statusStr = typeof status === "string" ? status.trim() : null;
    if (statusStr) {
      const allowedStatuses = new Set(["todo", "in_progress", "done", "archived"]);
      if (!allowedStatuses.has(statusStr)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      // archive/unarchive is a meta action
      const isArchiving = statusStr === "archived" && existing.status !== "archived";
      const isUnarchiving = statusStr !== "archived" && existing.status === "archived";
      if ((isArchiving || isUnarchiving) && !canEditMeta) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      }
    }

    // Only plain members (non project-managers) can update status only
    if (role === "member" && !isProjectManager) {
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

    if (assigneeIds && role !== "admin" && role !== "manager" && !isProjectManager) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const normalizedTags =
      Array.isArray(tags) ? JSON.stringify(tags.map(String)) : typeof tags === "string" ? tags : undefined;

    // Resolve listId (admin/manager only). Best-effort: if TaskList table missing, ignore.
    let resolvedListId: string | null | undefined = undefined;
    if (typeof listId === "string" || listId === null) {
      if (role !== "admin" && role !== "manager" && !isProjectManager) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      }
      if (listId === null) {
        // move to default list if possible; otherwise null
        try {
          const defaultList = await prisma.taskList.upsert({
            where: { projectId_name: { projectId: existing.projectId, name: DEFAULT_LIST_NAME } },
            create: { projectId: existing.projectId, name: DEFAULT_LIST_NAME },
            update: {},
            select: { id: true },
          });
          resolvedListId = defaultList.id;
        } catch (e) {
          if (!isMissingTableError(e, "TaskList")) throw e;
          resolvedListId = null;
        }
      } else {
        const candidate = String(listId).trim();
        if (!candidate) {
          resolvedListId = null;
        } else {
          try {
            const found = await prisma.taskList.findFirst({
              where: { id: candidate, projectId: existing.projectId },
              select: { id: true },
            });
            if (!found) return NextResponse.json({ error: "Invalid listId for project" }, { status: 400 });
            resolvedListId = found.id;
          } catch (e) {
            if (!isMissingTableError(e, "TaskList")) throw e;
            resolvedListId = null;
          }
        }
      }
    }

    const updated = await prisma.task.update({
      where: { id: params.id },
      data: {
        ...(typeof statusStr === "string" && statusStr ? { status: statusStr } : {}),
        ...(typeof priority === "string" ? { priority } : {}),
        ...(typeof title === "string" ? { title } : {}),
        ...(typeof description === "string" ? { description } : {}),
        ...(typeof list === "string" ? { list } : {}),
        ...(resolvedListId !== undefined ? { listId: resolvedListId } : {}),
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
        taskList: { select: { id: true, name: true } },
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
    if (typeof statusStr === "string" && statusStr && statusStr !== existing.status) {
      changes.push({ type: "task.status_changed", metadata: { from: existing.status, to: statusStr } });
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
    if (resolvedListId !== undefined && resolvedListId !== existing.listId) {
      changes.push({ type: "task.list_changed", metadata: { fromListId: existing.listId || null, toListId: resolvedListId } });
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
        project: { select: { members: { select: { userId: true, role: true } } } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const membership = existing.project?.members?.find((m) => m.userId === userId) || null;
    const isProjectMember = Boolean(membership);
    const projectRole = membership?.role ? String(membership.role) : "";
    const isProjectManager = projectRole === "owner" || projectRole === "manager";

    // Delete: admin always; manager if project member
    const canDelete = role === "admin" || isProjectManager || (role === "manager" && isProjectMember);
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
