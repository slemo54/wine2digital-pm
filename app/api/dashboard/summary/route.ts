import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";
import { formatTaskActivityEvent } from "@/lib/task-activity-format";

export const dynamic = "force-dynamic";

/**
 * Consolidated Dashboard Summary API
 * Fetches projects, assigned tasks, assigned subtasks, notifications, and activity in ONE request.
 * Reduces 5 network round-trips to 1, significantly improving perceived and actual performance.
 */
export async function GET(_req: NextRequest) {
  try {
    const me = await getSessionUser();
    if (!me) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = me.id;

    const [projects, tasks, subtasks, notifications, activityRows] = await Promise.all([
      // 1. Projects
      prisma.project.findMany({
        where: {
          OR: [{ creatorId: userId }, { members: { some: { userId } } }],
          status: "active",
        },
        include: {
          _count: { select: { tasks: true } },
          tasks: {
            where: { status: { not: "archived" } },
            select: { id: true, status: true },
          },
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
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          dueDate: true,
          project: { select: { id: true, name: true } },
        },
      }),

      // 3. Assigned Subtasks
      prisma.subtask.findMany({
        where: {
          assigneeId: userId,
          status: { not: "done" },
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
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

      // 4. Notifications
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),

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
        take: 10,
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

    // Compute unread count from the same result set or separate count
    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });

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

    // Normalize project data as the frontend expects
    const projectsWithComputed = projects.map((p) => {
      const totalTasks = p.tasks.length;
      const completedTasks = p.tasks.filter((t) => t.status === "done").length;
      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      return {
        ...p,
        status: "running", // normalized as in /api/projects
        completionRate,
        tasksCompleted: completedTasks,
        tasksTotal: totalTasks,
      };
    });

    return NextResponse.json({
      projects: projectsWithComputed,
      tasks,
      subtasks,
      notifications,
      unreadCount,
      activity: { events },
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
