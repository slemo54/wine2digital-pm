import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { buildTaskAssignedNotifications, normalizeUserIdList } from "@/lib/task-assignment-notifications";

export const dynamic = 'force-dynamic';

const DEFAULT_LIST_NAME = "Untitled list";

function isMissingTableError(err: unknown, table: string): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes(table) && msg.toLowerCase().includes("does not exist");
}

function normalizeTagName(input: string): string {
  return String(input || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

type TasksView = "default" | "projectLists" | "dashboard";

function normalizeTasksView(input: string | null): TasksView {
  const v = String(input || "").trim();
  if (v === "projectLists") return "projectLists";
  if (v === "dashboard") return "dashboard";
  return "default";
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const scope = (searchParams.get('scope') || 'all') as 'all' | 'assigned' | 'projects';
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const projectId = searchParams.get('projectId');
    const dueFrom = searchParams.get('dueFrom');
    const dueTo = searchParams.get('dueTo');
    const q = searchParams.get('q');
    const tag = searchParams.get('tag');
    const tagName = tag ? normalizeTagName(tag) : null;
    const view = normalizeTasksView(searchParams.get("view"));

    const page = Math.max(1, Number(searchParams.get('page') || 1));
    const pageSizeRaw = Number(searchParams.get('pageSize') || 50);
    const pageSize = Math.min(200, Math.max(1, pageSizeRaw));
    const skip = (page - 1) * pageSize;

    const accessFilter =
      scope === 'assigned'
        ? { assignees: { some: { userId } } }
        : scope === 'projects'
          ? { project: { members: { some: { userId } } } }
          : {
            OR: [
              { assignees: { some: { userId } } },
              { project: { members: { some: { userId } } } },
            ],
          };

    const where = {
      AND: [
        accessFilter,
        status && status !== 'all' ? { status } : { status: { not: "archived" } },
        priority && priority !== 'all' ? { priority } : {},
        projectId && projectId !== 'all' ? { projectId } : {},
        dueFrom || dueTo
          ? {
            dueDate: {
              ...(dueFrom ? { gte: new Date(dueFrom) } : {}),
              ...(dueTo ? { lte: new Date(dueTo) } : {}),
            },
          }
          : {},
        q
          ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' as const } },
              { description: { contains: q, mode: 'insensitive' as const } },
            ],
          }
          : {},
        tagName
          ? {
            OR: [
              { tags: { some: { name: tagName } } },
              { legacyTags: { contains: `"${tagName.replace(/"/g, '\\"')}"` } },
            ],
          }
          : {},
      ],
    } as const;

    const findManyArgs: any = {
      where: where as any,
      orderBy: [{ updatedAt: 'desc' }],
      skip,
      take: pageSize,
    };

    if (view === "projectLists") {
      findManyArgs.select = {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        listId: true,
        taskList: { select: { id: true, name: true } },
        legacyTags: true,
        tags: { select: { id: true, name: true } },
        amountCents: true,
      };
    } else if (view === "dashboard") {
      findManyArgs.select = {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        project: { select: { id: true, name: true } },
        _count: { select: { comments: true, attachments: true, subtasks: true } },
      };
    } else {
      findManyArgs.include = {
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
        _count: { select: { comments: true, attachments: true, subtasks: true } },
        subtasks: {
          where: { OR: [{ status: "done" }, { completed: true }] },
          select: { id: true }
        }
      };
    }

    const [total, tasks] = await Promise.all([
      prisma.task.count({ where: where as any }),
      prisma.task.findMany(findManyArgs),
    ]);

    return NextResponse.json({ tasks, page, pageSize, total });
  } catch (error) {
    console.error('List tasks error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id as string | undefined;
    const role = ((session.user as any).role as string | undefined) || 'member';

    const body = await req.json();
    const { title, description, projectId, priority, dueDate, assigneeIds, status, listId } = body;

    if (!title || !projectId) {
      return NextResponse.json(
        { error: 'Title and project ID are required' },
        { status: 400 }
      );
    }

    let normalizedAssigneeIds: string[] | undefined = undefined;
    if (assigneeIds !== undefined) {
      const tmp = normalizeUserIdList(assigneeIds);
      if (tmp === null) {
        return NextResponse.json({ error: "assigneeIds must be an array" }, { status: 400 });
      }
      normalizedAssigneeIds = tmp;
    }

    // Permissions: admin always; manager/member only if project member
    if (role !== 'admin') {
      const member = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: userId || '' } },
      });
      if (!member) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }

    // Resolve listId (best-effort; keep app functional even if migration not applied yet)
    let resolvedListId: string | null = null;
    if (typeof listId === "string" && listId.trim()) {
      try {
        const list = await prisma.taskList.findFirst({
          where: { id: String(listId), projectId },
          select: { id: true },
        });
        if (!list) {
          return NextResponse.json({ error: "Invalid listId for project" }, { status: 400 });
        }
        resolvedListId = list.id;
      } catch (e) {
        if (!isMissingTableError(e, "TaskList")) throw e;
        resolvedListId = null;
      }
    } else {
      try {
        const defaultList = await prisma.taskList.upsert({
          where: { projectId_name: { projectId, name: DEFAULT_LIST_NAME } },
          create: { projectId, name: DEFAULT_LIST_NAME },
          update: {},
          select: { id: true },
        });
        resolvedListId = defaultList.id;
      } catch (e) {
        if (!isMissingTableError(e, "TaskList")) throw e;
        resolvedListId = null;
      }
    }

    const task = await prisma.task.create({
      data: {
        title,
        description: description || '',
        projectId,
        priority: priority || 'medium',
        status: status || 'todo',
        dueDate: dueDate ? new Date(dueDate) : null,
        ...(resolvedListId ? { listId: resolvedListId } : {}),
        assignees: normalizedAssigneeIds && normalizedAssigneeIds.length > 0
          ? {
            create: normalizedAssigneeIds.map((uid: string) => ({ userId: uid })),
          }
          : undefined,
      },
      include: {
        taskList: { select: { id: true, name: true } },
        assignees: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // In-app notifications for initial assignees (best-effort)
    if (normalizedAssigneeIds && normalizedAssigneeIds.length > 0) {
      const actorId = String(userId || "");
      const added = normalizedAssigneeIds.filter((id) => id && id !== actorId);
      if (added.length > 0) {
        const actorLabel = String((session.user as any)?.name || (session.user as any)?.email || "Un collega");
        const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }).catch(() => null);
        const items = buildTaskAssignedNotifications({
          assigneeIds: added,
          actorLabel,
          taskId: task.id,
          taskTitle: String(task.title || "Task"),
          projectName: project?.name ? String(project.name) : null,
        });
        try {
          await prisma.notification.createMany({ data: items });
        } catch (e) {
          console.error("Task assignment notification failed:", e);
        }
      }
    }

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error('Create task error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
