import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { formatTaskActivityEvent } from "@/lib/task-activity-format";

export const dynamic = "force-dynamic";

/**
 * Unified Dashboard Summary API
 * Consolidates 5 API calls into 1 for significantly faster dashboard loading.
 * Reduces network round-trips and database connection overhead.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id as string;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Run all queries in parallel for maximum performance
    const [projects, tasks, subtasks, notifications, unreadCount, activityRows] = await Promise.all([
      // 1. Projects
      prisma.project.findMany({
        where: {
          OR: [{ creatorId: userId }, { members: { some: { userId } } }],
        },
        include: {
          creator: { select: { id: true, firstName: true, lastName: true, email: true, name: true } },
          members: {
            select: {
              userId: true,
              role: true,
              user: { select: { id: true, firstName: true, lastName: true, email: true, name: true } },
            },
          },
          tasks: {
            where: { status: { not: "archived" } },
            select: { id: true, status: true },
          },
          _count: { select: { tasks: true } },
        },
        orderBy: { createdAt: "desc" },
      }),

      // 2. Assigned Tasks
      prisma.task.findMany({
        where: {
          AND: [{ assignees: { some: { userId } } }, { status: { not: "archived" } }],
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 50,
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
      }),

      // 3. Assigned Subtasks
      prisma.subtask.findMany({
        where: {
          AND: [{ assigneeId: userId }, { status: { not: "done" } }], // Usually we want pending work on dashboard
        },
        orderBy: [{ updatedAt: "desc" }],
        take: 50,
        select: {
          id: true,
          taskId: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          createdAt: true,
          updatedAt: true,
          task: {
            select: {
              id: true,
              title: true,
              project: { select: { id: true, name: true } },
            },
          },
        },
      }),

      // 4. Notifications
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),

      // 5. Unread Count
      prisma.notification.count({
        where: { userId, isRead: false },
      }),

      // 6. Recent Activity
      prisma.taskActivity.findMany({
        where: {
          task: {
            OR: [{ assignees: { some: { userId } } }, { project: { members: { some: { userId } } } }],
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

    // Process projects (add computed fields as in /api/projects/route.ts)
    const processedProjects = projects.map((project) => {
      const totalTasks = project.tasks.length;
      const completedTasks = project.tasks.filter((task) => task.status === "done").length;
      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      const normalizedStatus = project.status === "active" ? "running" : project.status;

      return {
        ...project,
        status: normalizedStatus,
        completionRate,
        tasksCompleted: completedTasks,
        tasksTotal: totalTasks,
      };
    });

    // Process activity (format messages as in /api/activity/route.ts)
    const processedActivity = activityRows.map((r) => {
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
      projects: { projects: processedProjects },
      tasks: { tasks },
      subtasks: { subtasks },
      notifications: { notifications, unreadCount },
      activity: { events: processedActivity },
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
