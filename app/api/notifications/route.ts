import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

function buildMarkNotificationReadWhere(userId: string, notificationId: string) {
  return { id: notificationId, userId } as const;
}

function buildMarkTaskNotificationsReadWhere(userId: string, taskId: string) {
  const token = `taskId=${encodeURIComponent(taskId)}`;
  return {
    userId,
    isRead: false,
    link: { contains: token },
  } as const;
}

export const dynamic = 'force-dynamic';

// GET - List user's notifications
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50, // Limit to last 50 notifications
    });

    const unreadCount = await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    console.error('List notifications error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Mark notification as read
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await req.json();
    const { notificationId, markAllRead, taskId, subtaskId, types, excludeTypes } = body || {};

    const normalizeStringArray = (input: unknown): string[] | null => {
      if (input === undefined) return [];
      if (!Array.isArray(input)) return null;
      return Array.from(new Set(input.map((x) => String(x ?? "").trim()).filter(Boolean)));
    };

    const normalizedTypes = types === undefined ? undefined : normalizeStringArray(types);
    if (types !== undefined && normalizedTypes === null) {
      return NextResponse.json({ error: "types must be an array of strings" }, { status: 400 });
    }
    const normalizedExcludeTypes = excludeTypes === undefined ? undefined : normalizeStringArray(excludeTypes);
    if (excludeTypes !== undefined && normalizedExcludeTypes === null) {
      return NextResponse.json({ error: "excludeTypes must be an array of strings" }, { status: 400 });
    }

    if (markAllRead) {
      await prisma.notification.updateMany({
        where: {
          userId,
          isRead: false,
        },
        data: {
          isRead: true,
        },
      });
    } else if (typeof notificationId === "string" && notificationId.trim()) {
      // Safety: ensure we only update notifications owned by the current user
      await prisma.notification.updateMany({
        where: buildMarkNotificationReadWhere(userId, notificationId.trim()),
        data: { isRead: true },
      });
    } else if (typeof taskId === "string" && taskId.trim()) {
      const base = buildMarkTaskNotificationsReadWhere(userId, taskId.trim());
      const and: any[] = [{ link: (base as any).link }];
      if (typeof subtaskId === "string" && subtaskId.trim()) {
        and.push({ link: { contains: `subtaskId=${encodeURIComponent(subtaskId.trim())}` } });
      }
      if (normalizedTypes && normalizedTypes.length > 0) {
        and.push({ type: { in: normalizedTypes } });
      }
      if (normalizedExcludeTypes && normalizedExcludeTypes.length > 0) {
        and.push({ type: { notIn: normalizedExcludeTypes } });
      }
      await prisma.notification.updateMany({
        where: {
          userId,
          isRead: false,
          AND: and,
        },
        data: { isRead: true },
      });
    }

    const unreadCount = await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    return NextResponse.json({ message: 'Notification(s) marked as read', unreadCount });
  } catch (error) {
    console.error('Update notification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
