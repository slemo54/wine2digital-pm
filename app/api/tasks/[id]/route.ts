import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { buildTaskAssignedNotifications, getAddedAssigneeIds, normalizeUserIdList } from "@/lib/task-assignment-notifications";
import { MEMBER_TASK_EDITABLE_KEYS, validateMemberTaskUpdateKeys } from "@/lib/task-update-policy";

const DEFAULT_LIST_NAME = "Untitled list";

function isMissingTableError(err: unknown, table: string): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes(table) && msg.toLowerCase().includes("does not exist");
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const url = new URL(request.url);
  const perf = url.searchParams.get("perf") === "1";
  // "light" view omits project.members for faster initial drawer render
  const view = url.searchParams.get("view") as "light" | "full" | null;
  const isLightView = view === "light";

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

    // For light view, we still need members for permission check but we fetch minimal data
    const task = await prisma.task.findUnique({
      where: { id: params.id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            // For light view, only fetch userId for permission check (no user details)
            members: isLightView
              ? { select: { userId: true, role: true } }
              : {
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
        tags: { select: { id: true, name: true } },
        taskList: { select: { id: true, name: true } },
        _count: { select: { comments: true, attachments: true, subtasks: true } },
      },
    });
    const tDb1 = typeof performance !== "undefined" ? performance.now() : Date.now();

    if (!task) {
      const headers = perf
        ? { "Server-Timing": `auth;dur=${(tAuth - t0).toFixed(1)},db;dur=${(tDb1 - tDb0).toFixed(1)}` }
        : undefined;
      return NextResponse.json({ error: "Task not found" }, { status: 404, headers });
    }

    const isAssignee = task.assignees.some((a) => a.userId === userId);
    const isProjectMember = task.project?.members?.some((m) => m.userId === userId) || false;

    const canRead = role === "admin" || isAssignee || isProjectMember;
    if (!canRead) {
      const headers = perf
        ? { "Server-Timing": `auth;dur=${(tAuth - t0).toFixed(1)},db;dur=${(tDb1 - tDb0).toFixed(1)}` }
        : undefined;
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403, headers });
    }

    // For light view, strip members from response (frontend fetches on-demand)
    const responseTask = isLightView
      ? {
          ...task,
          project: task.project
            ? { id: task.project.id, name: task.project.name }
            : null,
        }
      : task;

    const tEnd = typeof performance !== "undefined" ? performance.now() : Date.now();
    const headers = perf
      ? {
          "Server-Timing": `auth;dur=${(tAuth - t0).toFixed(1)},db;dur=${(tDb1 - tDb0).toFixed(1)},total;dur=${(tEnd - t0).toFixed(1)}`,
        }
      : undefined;

    return NextResponse.json(responseTask, { headers });
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
        tags: { select: { id: true } },
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
      (role === "member" && isProjectMember);
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
      tags: legacyTags,
      storyPoints,
      list,
      listId,
      assigneeIds,
      tagIds,
      amountCents,
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
      const validation = validateMemberTaskUpdateKeys(body);
      if (!validation.ok) {
        return NextResponse.json(
          {
            error: `Members can only update: ${MEMBER_TASK_EDITABLE_KEYS.join(", ")}`,
            invalid: validation.invalidKeys,
          },
          { status: 400 }
        );
      }
    }

    if (assigneeIds !== undefined && role !== "admin" && role !== "manager" && !isProjectManager) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    let normalizedAssigneeIds: string[] | undefined = undefined;
    if (assigneeIds !== undefined) {
      const tmp = normalizeUserIdList(assigneeIds);
      if (tmp === null) {
        return NextResponse.json({ error: "assigneeIds must be an array" }, { status: 400 });
      }
      normalizedAssigneeIds = tmp;
    }

    if (
      (legacyTags !== undefined || tagIds !== undefined || amountCents !== undefined) &&
      !canEditMeta
    ) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const normalizedLegacyTags =
      Array.isArray(legacyTags)
        ? JSON.stringify(legacyTags.map(String))
        : typeof legacyTags === "string"
          ? legacyTags
          : undefined;

    const normalizedTagIds = Array.isArray(tagIds)
      ? Array.from(new Set(tagIds.map((x: any) => String(x || "").trim()).filter(Boolean)))
      : tagIds === undefined
        ? undefined
        : null;
    if (normalizedTagIds === null) {
      return NextResponse.json({ error: "tagIds must be an array" }, { status: 400 });
    }

    const normalizedAmountCents =
      amountCents === undefined
        ? undefined
        : amountCents === null
          ? null
          : typeof amountCents === "number" && Number.isFinite(amountCents) && Number.isInteger(amountCents) && amountCents >= 0
            ? amountCents
            : null;
    if (amountCents !== undefined && normalizedAmountCents === null) {
      return NextResponse.json({ error: "amountCents must be an integer >= 0 (or null)" }, { status: 400 });
    }

    const resolvedTags =
      normalizedTagIds !== undefined
        ? await prisma.projectTag.findMany({
            where: { id: { in: normalizedTagIds }, projectId: existing.projectId },
            select: { id: true },
          })
        : null;
    if (normalizedTagIds !== undefined && resolvedTags && resolvedTags.length !== normalizedTagIds.length) {
      return NextResponse.json({ error: "Invalid tagIds for project" }, { status: 400 });
    }

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
        ...(normalizedAmountCents !== undefined ? { amountCents: normalizedAmountCents } : {}),
        ...(typeof dueDate === "string" || dueDate === null
          ? { dueDate: dueDate ? new Date(dueDate) : null }
          : {}),
        ...(typeof normalizedLegacyTags === "string" || legacyTags === null
          ? { legacyTags: legacyTags === null ? null : normalizedLegacyTags }
          : {}),
        ...(normalizedTagIds !== undefined
          ? { tags: { set: resolvedTags?.map((t) => ({ id: t.id })) || [] } }
          : {}),
        ...(normalizedAssigneeIds !== undefined
          ? {
              assignees: {
                deleteMany: {},
                create: normalizedAssigneeIds.map((uid: string) => ({ userId: uid })),
              },
            }
          : {}),
      },
      include: {
        project: { select: { id: true, name: true } },
        taskList: { select: { id: true, name: true } },
        tags: { select: { id: true, name: true } },
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
    if (normalizedAmountCents !== undefined && normalizedAmountCents !== existing.amountCents) {
      changes.push({ type: "task.amount_changed", metadata: { from: existing.amountCents ?? null, to: normalizedAmountCents } });
    }
    if (typeof normalizedLegacyTags === "string" || legacyTags === null) {
      if ((existing.legacyTags || null) !== (legacyTags === null ? null : normalizedLegacyTags || null)) {
        changes.push({
          type: "task.legacy_tags_changed",
          metadata: { from: existing.legacyTags || null, to: legacyTags === null ? null : normalizedLegacyTags || null },
        });
      }
    }
    if (normalizedTagIds !== undefined) {
      const prev = Array.isArray(existing.tags) ? existing.tags.map((t: any) => t.id).sort() : [];
      const next = normalizedTagIds.slice().sort();
      if (JSON.stringify(prev) !== JSON.stringify(next)) {
        changes.push({ type: "task.tags_changed", metadata: { from: prev, to: next } });
      }
    }
    if (normalizedAssigneeIds !== undefined) {
      const prevAssignees = existing.assignees.map((a) => a.userId).sort();
      const nextAssignees = normalizedAssigneeIds.slice().sort();
      if (JSON.stringify(prevAssignees) !== JSON.stringify(nextAssignees)) {
        changes.push({ type: "task.assignees_changed", metadata: { from: prevAssignees, to: nextAssignees } });
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

    // In-app notifications: notify newly assigned users (best-effort)
    if (normalizedAssigneeIds !== undefined) {
      const added = getAddedAssigneeIds({
        prevAssigneeIds: existing.assignees.map((a) => a.userId),
        nextAssigneeIds: normalizedAssigneeIds,
        actorUserId: userId,
      });
      if (added.length > 0) {
        const actorLabel = String((session.user as any)?.name || (session.user as any)?.email || "Un collega");
        const items = buildTaskAssignedNotifications({
          assigneeIds: added,
          actorLabel,
          taskId: params.id,
          taskTitle: String(updated.title || "Task"),
          projectName: (updated as any)?.project?.name ? String((updated as any).project.name) : null,
        });
        try {
          await prisma.notification.createMany({ data: items });
        } catch (e) {
          console.error("Task assignment notification failed:", e);
        }
      }
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
