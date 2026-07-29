import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";
import { formatTaskActivityEvent } from "@/lib/task-activity-format";

export const dynamic = "force-dynamic";

/**
 * Unified API endpoint for dashboard data.
 * Consolidates 5 separate requests into 1 to improve performance.
 */
export async function GET(_req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

    // Fetch all dashboard data in parallel on the server
    const [projects, tasks, subtasks, notifications, unreadCount, activityRows] = await Promise.all([
      // 1. Recent Projects
      prisma.project.findMany({
        where: {
          OR: [{ creatorId: userId }, { members: { some: { userId } } }],
          status: { not: "archived" },
        },
        include: {
          _count: { select: { tasks: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),
      // 2. My Tasks (Assigned and not done)
      prisma.task.findMany({
        where: {
          assignees: { some: { userId } },
          status: { not: "done" },
        },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          dueDate: true,
          project: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      // 3. My Subtasks (Assigned and not done)
      prisma.subtask.findMany({
        where: {
          assigneeId: userId,
          status: { not: "done" },
        },
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
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      // 4. Notifications
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      // 5. Unread notifications count
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
      // 6. Recent Activity
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
        take: 20,
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

    // Format activity events using the existing utility
    const events = activityRows.map((r) => {
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

    // Return the data structured exactly as the frontend dashboard expects it
    return NextResponse.json({
      projects: { projects },
      tasks: { tasks },
      subtasks: { subtasks },
      notifications: { notifications, unreadCount },
      activity: { events },
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
