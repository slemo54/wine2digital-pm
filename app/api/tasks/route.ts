import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const DEFAULT_LIST_NAME = "Untitled list";

function isMissingTableError(err: unknown, table: string): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes(table) && msg.toLowerCase().includes("does not exist");
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
        status && status !== 'all' ? { status } : {},
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
        tag
          ? {
            tags: { contains: `"${tag.replace(/"/g, '\\"')}"` },
          }
          : {},
      ],
    } as const;

    const [total, tasks] = await Promise.all([
      prisma.task.count({ where: where as any }),
      prisma.task.findMany({
        where: where as any,
        orderBy: [{ updatedAt: 'desc' }],
        skip,
        take: pageSize,
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
          _count: { select: { comments: true, attachments: true, subtasks: true } },
          subtasks: {
            where: { OR: [{ status: "done" }, { completed: true }] },
            select: { id: true }
          }
        },
      }),
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
        assignees: assigneeIds && Array.isArray(assigneeIds) && assigneeIds.length > 0
          ? {
            create: assigneeIds.map((userId: string) => ({
              userId,
            })),
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

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error('Create task error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
