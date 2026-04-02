import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";
import { formatTaskActivityEvent } from "@/lib/task-activity-format";

export const dynamic = "force-dynamic";

/**
 * Unified API Endpoint for the dashboard summary.
 * Consolidates 5 calls into 1: Projects, Assigned Tasks, Assigned Subtasks, Notifications, and Activity.
 */
export async function GET(_req: NextRequest) {
  try {
    const me = await getSessionUser();
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = me.id;

    // Execute all queries in parallel for maximum efficiency
    const [projectsData, tasks, subtasks, notifications, unreadCount, activityRows] = await Promise.all([
      // 1. Projects (Limited to 10 as per default in app/api/projects/route.ts)
      prisma.project.findMany({
        where: {
          OR: [{ creatorId: userId }, { members: { some: { userId } } }],
          status: "active",
        },
        include: {
          creator: { select: { id: true, firstName: true, lastName: true, email: true, name: true } },
          members: { select: { userId: true, role: true, user: { select: { id: true, firstName: true, lastName: true, email: true, name: true } } } },
          tasks: { where: { status: { not: "archived" } }, select: { id: true, status: true } },
          _count: { select: { tasks: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),

      // 2. Assigned Tasks (Paginated at 50)
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
        take: 50,
      }),

      // 3. Assigned Subtasks (Paginated at 50)
      prisma.subtask.findMany({
        where: {
          assigneeId: userId,
          status: { not: "done" }, // Only incomplete subtasks for the dashboard
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

      // 4. Notifications (Last 50)
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),

      // 5. Unread Count
      prisma.notification.count({
        where: { userId, isRead: false },
      }),

      // 6. Recent Activity (Last 25)
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
        take: 25,
        include: {
          actor: { select: { id: true, email: true, name: true, firstName: true, lastName: true, image: true } },
          task: { select: { id: true, title: true, projectId: true, project: { select: { name: true } } } },
        },
      }),
    ]);

    // Post-processing for projects (calculate completion rate)
    const processedProjects = projectsData.map((project) => {
      const totalTasks = project.tasks.length;
      const completedTasks = project.tasks.filter((task) => task.status === "done").length;
      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      return {
        ...project,
        status: project.status === "active" ? "running" : project.status, // Normalize status for UI
        completionRate,
        tasksCompleted: completedTasks,
        tasksTotal: totalTasks,
      };
    });

    // Format activity events
    const activityEvents = activityRows.map((r) => {
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
      activity: { events: activityEvents },
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
