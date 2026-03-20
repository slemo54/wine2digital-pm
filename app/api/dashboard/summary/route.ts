import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { formatTaskActivityEvent } from "@/lib/task-activity-format";

export const dynamic = "force-dynamic";

/**
 * Unified API endpoint for Dashboard data aggregation.
 * Reduces 5 separate network requests into 1.
 * Uses Promise.allSettled to ensure partial failures don't block the entire dashboard.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id as string | undefined;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all dashboard data in parallel
    const results = await Promise.allSettled([
      // 1. Projects (Active projects where user is creator or member)
      prisma.project.findMany({
        where: {
          OR: [{ creatorId: userId }, { members: { some: { userId } } }],
          status: "active",
        },
        include: {
          _count: { select: { tasks: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),

      // 2. Assigned Tasks (Non-archived tasks assigned to the user)
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

      // 3. Assigned Subtasks (Incomplete subtasks assigned to the user)
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

      // 4. Notifications (Latest 5 notifications + unread count)
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 5,
      }).then(async (notifications) => {
        const unreadCount = await prisma.notification.count({
          where: { userId, isRead: false },
        });
        return { notifications, unreadCount };
      }),

      // 5. Recent Activity (Latest 5 activities related to user's projects/tasks)
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
        take: 5,
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
      }).then((rows) => {
        return rows.map((r) => {
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
      }),
    ]);

    // Map results, handling potential failures gracefully
    const [projects, tasks, subtasks, notifications, activity] = results.map(
      (res) => (res.status === "fulfilled" ? res.value : null)
    );

    return NextResponse.json({
      projects: { projects: projects || [] },
      tasks: { tasks: tasks || [] },
      subtasks: { subtasks: subtasks || [] },
      notifications: notifications || { notifications: [], unreadCount: 0 },
      activity: { events: activity || [] },
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
