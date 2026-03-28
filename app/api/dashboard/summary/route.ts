import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { formatTaskActivityEvent } from "@/lib/task-activity-format";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all dashboard data in parallel for maximum performance
    const [
      projectsRes,
      tasksRes,
      subtasksRes,
      notificationsRes,
      activityRes,
    ] = await Promise.allSettled([
      // 1. Projects (limit 10, newest first)
      prisma.project.findMany({
        where: {
          OR: [{ creatorId: userId }, { members: { some: { userId } } }],
        },
        include: {
          tasks: {
            where: { status: { not: "archived" } },
            select: { id: true, status: true },
          },
          _count: { select: { tasks: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),

      // 2. Assigned Tasks
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
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),

      // 3. Assigned Subtasks
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

      // 4. Notifications & Unread Count
      Promise.all([
        prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
        prisma.notification.count({
          where: { userId, isRead: false },
        }),
      ]),

      // 5. Recent Activity
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

    // Process results
    const projects = projectsRes.status === "fulfilled" ? projectsRes.value.map((p: any) => {
      const totalTasks = p.tasks.length;
      const completedTasks = p.tasks.filter((t: any) => t.status === "done").length;
      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      return {
        ...p,
        status: p.status === "active" ? "running" : p.status,
        completionRate,
        tasksCompleted: completedTasks,
        tasksTotal: totalTasks,
      };
    }) : [];

    const tasks = tasksRes.status === "fulfilled" ? tasksRes.value : [];
    const subtasks = subtasksRes.status === "fulfilled" ? subtasksRes.value : [];

    const notificationsData = notificationsRes.status === "fulfilled" ? notificationsRes.value : [[], 0];
    const notifications = notificationsData[0];
    const unreadCount = notificationsData[1];

    const activity = activityRes.status === "fulfilled" ? activityRes.value.map((r: any) => {
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
    }) : [];

    return NextResponse.json({
      projects,
      tasks,
      subtasks,
      notifications,
      unreadCount,
      activity,
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
