import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { formatTaskActivityEvent } from "@/lib/task-activity-format";

export const dynamic = "force-dynamic";

interface ActivityRow {
  id: string;
  type: string;
  createdAt: Date;
  metadata: any;
  actor: {
    id: string;
    email: string;
    name: string | null;
    firstName: string | null;
    lastName: string | null;
    image: string | null;
  } | null;
  task: {
    id: string;
    title: string;
    projectId: string;
    project: {
      name: string;
    } | null;
  };
}

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

    // Fetch all dashboard data in parallel using Promise.allSettled for resilience
    const [projectsResult, tasksResult, subtasksResult, notificationsResult, activityResult] = await Promise.allSettled([
      // 1. Projects
      prisma.project.findMany({
        where: {
          OR: [{ creatorId: userId }, { members: { some: { userId } } }],
          status: { not: "archived" },
        },
        include: {
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
          _count: { select: { comments: true, attachments: true, subtasks: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
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
      }) as Promise<ActivityRow[]>,
    ]);

    const activityRows = activityResult.status === "fulfilled" ? activityResult.value : [];
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
      projects: {
        projects: projectsResult.status === "fulfilled" ? projectsResult.value : [],
      },
      tasks: {
        tasks: tasksResult.status === "fulfilled" ? tasksResult.value : [],
      },
      subtasks: {
        subtasks: subtasksResult.status === "fulfilled" ? subtasksResult.value : [],
      },
      notifications: notificationsResult.status === "fulfilled" ? notificationsResult.value : { notifications: [], unreadCount: 0 },
      activity: {
        events: activityEvents,
      },
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
