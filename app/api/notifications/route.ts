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
    const { notificationId, markAllRead, taskId } = body || {};

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
      await prisma.notification.updateMany({
        where: buildMarkTaskNotificationsReadWhere(userId, taskId.trim()),
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
