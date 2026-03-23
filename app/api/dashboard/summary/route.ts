import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";
import { formatTaskActivityEvent } from "@/lib/task-activity-format";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const me = await getSessionUser();
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = me.id;

    const [projectsRes, tasksRes, subtasksRes, notificationsRes, activityRes] = await Promise.allSettled([
      // Projects
      prisma.project.findMany({
        where: {
          OR: [
            { creatorId: userId },
            { members: { some: { userId } } },
          ],
        },
        include: {
          _count: { select: { tasks: true } },
          members: { select: { userId: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      // Tasks
      prisma.task.findMany({
        where: {
          assignees: { some: { userId } },
          status: { not: "archived" },
        },
        include: {
          project: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
      }),
      // Subtasks
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
        take: 50,
      }),
      // Notifications
      (async () => {
        const [notifications, unreadCount] = await Promise.all([
          prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 50,
          }),
          prisma.notification.count({
            where: { userId, isRead: false },
          }),
        ]);
        return { notifications, unreadCount };
      })(),
      // Activity
      prisma.taskActivity.findMany({
        where: {
          task: {
            OR: [
              { assignees: { some: { userId: me.id } } },
              { project: { members: { some: { userId: me.id } } } },
            ],
          },
        },
        orderBy: { createdAt: "desc" },
        take: 25,
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

    const projects = projectsRes.status === "fulfilled" ? projectsRes.value : [];
    const tasks = tasksRes.status === "fulfilled" ? tasksRes.value : [];
    const subtasks = subtasksRes.status === "fulfilled" ? subtasksRes.value : [];
    const notificationsData = notificationsRes.status === "fulfilled" ? (notificationsRes.value as { notifications: any[], unreadCount: number }) : { notifications: [], unreadCount: 0 };
    const activityRows = activityRes.status === "fulfilled" ? activityRes.value : [];

    // Format activity events
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

    return NextResponse.json({
      projects,
      tasks,
      subtasks,
      notifications: notificationsData.notifications,
      unreadCount: notificationsData.unreadCount,
      events,
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
