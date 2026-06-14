import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { formatTaskActivityEvent } from "@/lib/task-activity-format";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all dashboard data in parallel using Promise.allSettled for maximum resilience
    const [
      projectsRes,
      tasksRes,
      subtasksRes,
      notificationsRes,
      activityRes
    ] = await Promise.allSettled([
      // 1. Projects
      prisma.project.findMany({
        where: {
          OR: [
            { creatorId: userId },
            { members: { some: { userId } } },
          ],
          status: 'active',
        },
        include: {
          _count: { select: { tasks: true } },
          tasks: {
            where: { status: { not: "archived" } },
            select: { id: true, status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),

      // 2. Assigned Tasks
      prisma.task.findMany({
        where: {
          assignees: { some: { userId } },
          status: { not: "archived" },
        },
        orderBy: { updatedAt: 'desc' },
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
          assigneeId: userId,
          status: { not: "archived" },
        },
        orderBy: { updatedAt: 'desc' },
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
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),

      // 5. Activity
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
          actor: {
            select: {
              id: true, email: true, name: true, firstName: true, lastName: true, image: true,
            },
          },
          task: {
            select: {
              id: true, title: true, projectId: true,
              project: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    // Process Projects with computed fields
    const rawProjects = projectsRes.status === 'fulfilled' ? projectsRes.value : [];
    const projects = rawProjects.map((project) => {
      const totalTasks = project.tasks.length;
      const completedTasks = project.tasks.filter((task: any) => task.status === 'done').length;
      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      return {
        ...project,
        status: 'running', // UI expects 'running' for active projects
        completionRate,
        tasksCompleted: completedTasks,
        tasksTotal: totalTasks,
      };
    });

    // Process Activity with formatting
    const rawActivity = activityRes.status === 'fulfilled' ? activityRes.value : [];
    const activityEvents = rawActivity.map((r) => {
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

    const notifications = notificationsRes.status === 'fulfilled' ? notificationsRes.value : [];
    const unreadCount = notifications.filter((n: any) => !n.isRead).length;

    return NextResponse.json({
      projects: { projects },
      tasks: { tasks: tasksRes.status === 'fulfilled' ? tasksRes.value : [] },
      subtasks: { subtasks: subtasksRes.status === 'fulfilled' ? subtasksRes.value : [] },
      notifications: { notifications, unreadCount },
      activity: { events: activityEvents },
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
