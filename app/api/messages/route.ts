import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function parseOptionalInt(input: string | null): number | null {
  if (input === null) return null;
  const n = Number(input);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function parseOptionalDate(input: string | null): Date | null {
  if (!input) return null;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// GET - List messages for a project
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = String((session.user as any).id || '');
    const globalRole = String((session.user as any).role || '');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const takeRaw = parseOptionalInt(searchParams.get('take'));
    const after = parseOptionalDate(searchParams.get('after'));
    const before = parseOptionalDate(searchParams.get('before'));

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }

    if (searchParams.get('after') && !after) {
      return NextResponse.json({ error: 'Invalid after' }, { status: 400 });
    }
    if (searchParams.get('before') && !before) {
      return NextResponse.json({ error: 'Invalid before' }, { status: 400 });
    }
    if (after && before) {
      return NextResponse.json({ error: 'Provide only one of after/before' }, { status: 400 });
    }

    if (globalRole !== 'admin') {
      const membership = await prisma.projectMember.findFirst({
        where: { projectId, userId },
        select: { id: true },
      });
      if (!membership) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }

    const take = Math.max(1, Math.min(200, takeRaw ?? 50));

    // "after": incremental updates (new messages), ascending
    if (after) {
      const messages = await prisma.message.findMany({
        where: { projectId, createdAt: { gt: after } },
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
        orderBy: { createdAt: 'asc' },
        take,
      });

      return NextResponse.json({ messages, pageInfo: { hasMoreBefore: undefined, oldest: messages[0]?.createdAt?.toISOString?.() } });
    }

    // Default + "before": pagination backwards (older messages)
    const where: any = { projectId };
    if (before) where.createdAt = { lt: before };

    const rows = await prisma.message.findMany({
      where,
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
      orderBy: { createdAt: 'desc' },
      take: take + 1,
    });

    const hasMoreBefore = rows.length > take;
    const trimmed = hasMoreBefore ? rows.slice(0, take) : rows;
    const messages = [...trimmed].reverse();
    const oldest = messages[0]?.createdAt ? new Date(messages[0].createdAt).toISOString() : null;

    return NextResponse.json({ messages, pageInfo: { hasMoreBefore, oldest } });
  } catch (error) {
    console.error('List messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new message
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = String((session.user as any).id || '');
    const globalRole = String((session.user as any).role || '');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { projectId, content } = body;

    const text = typeof content === 'string' ? content.trim() : '';
    if (!projectId || !text) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (globalRole !== 'admin') {
      const membership = await prisma.projectMember.findFirst({
        where: { projectId, userId },
        select: { id: true },
      });
      if (!membership) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }

    const message = await prisma.message.create({
      data: {
        projectId,
        userId,
        content: text,
      },
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
    });

    // Create notifications for other project members
    const projectMembers = await prisma.projectMember.findMany({
      where: {
        projectId,
        userId: { not: userId },
      },
    });

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    await prisma.notification.createMany({
      data: projectMembers.map((member: { userId: string }) => ({
        userId: member.userId,
        type: 'message_received',
        title: 'New message',
        message: `New message in ${project?.name || 'project'}`,
        link: `/project/${projectId}`,
      })),
    });

    return NextResponse.json({ message });
  } catch (error) {
    console.error('Create message error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
