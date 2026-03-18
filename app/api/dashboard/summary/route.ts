import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { formatTaskActivityEvent } from "@/lib/task-activity-format";

export const dynamic = "force-dynamic";

/**
 * Unified Dashboard Summary API
 * Consolidates multiple data fetches into a single request to improve performance.
 * Reduces network round-trips from 5 to 1.
 * USES Promise.allSettled for resilience: if one part fails, the others still load.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Run all queries in parallel for maximum performance
    const results = await Promise.allSettled([
      // 0. Projects
      prisma.project.findMany({
        where: {
          OR: [
            { creatorId: userId },
            { members: { some: { userId } } },
          ],
          status: { not: "archived" },
        },
        include: {
          _count: { select: { tasks: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),

      // 1. Assigned Tasks
      prisma.task.findMany({
        where: {
          assignees: { some: { userId } },
          status: { not: "archived" },
        },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          dueDate: true,
          project: { select: { id: true, name: true } },
          _count: { select: { comments: true, attachments: true, subtasks: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),

      // 2. Assigned Subtasks
      prisma.subtask.findMany({
        where: {
          assigneeId: userId,
          status: { not: "done" },
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: {
          id: true,
          taskId: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          task: {
            select: {
              id: true,
              title: true,
              project: { select: { id: true, name: true } },
            },
          },
        },
      }),

      // 3. Notifications
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),

      // 4. Unread Notifications Count
      prisma.notification.count({
        where: { userId, isRead: false },
      }),

      // 5. Activity Feed
      prisma.taskActivity.findMany({
        where: {
          task: {
            OR: [
              { assignees: { some: { userId } } },
              { project: { members: { some: { userId } } } },
            ],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 15,
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              name: true,
              firstName: true,
              lastName: true,
              image: true,
            },
          },
          task: {
            select: {
              id: true,
              title: true,
              projectId: true,
              project: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    const getValue = <T>(index: number, defaultValue: T): T => {
      const res = results[index];
      return res.status === "fulfilled" ? (res.value as T) : defaultValue;
    };

    const projects = getValue(0, []);
    const tasks = getValue(1, []);
    const subtasks = getValue(2, []);
    const notifications = getValue(3, []);
    const unreadCount = getValue(4, 0);
    const activityRows = getValue(5, []);

    // Format activity events
    const activityEvents = activityRows.map((r: any) => {
      const formatted = formatTaskActivityEvent({
        id: r.id,
        type: r.type,
        createdAt: r.createdAt.toISOString(),
        actor: r.actor,
        metadata: r.metadata,
      });

      return {
        id: r.id,
        type: r.type,
        createdAt: r.createdAt.toISOString(),
        actor: r.actor,
        message: formatted.message,
        task: {
          id: r.task.id,
          title: r.task.title,
          projectId: r.task.projectId,
          projectName: r.task.project?.name || "",
        },
        href: `/project/${r.task.projectId}?task=${r.task.id}`,
      };
    });

    return NextResponse.json({
      // Consistent with expectations in DashboardPage.tsx
      projects: { projects },
      tasks: { tasks },
      subtasks: { subtasks },
      notifications: { notifications, unreadCount },
      activity: { events: activityEvents },
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
