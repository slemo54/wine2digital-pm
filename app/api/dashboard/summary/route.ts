import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { formatTaskActivityEvent } from "@/lib/task-activity-format";

export const dynamic = "force-dynamic";

/**
 * ⚡ Unified dashboard summary endpoint
 * Consolidates 5 API calls into 1 to reduce network overhead and waterfalls.
 */
export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use Promise.allSettled for parallel fetching with resilience
    const results = await Promise.allSettled([
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

      // 4. Notifications
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),

      // 5. Unread notification count
      prisma.notification.count({
        where: { userId, isRead: false },
      }),

      // 6. Activity Log
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

    // Handle results and format activity
    const projects = results[0].status === "fulfilled" ? results[0].value : [];
    const tasks = results[1].status === "fulfilled" ? results[1].value : [];
    const subtasks = results[2].status === "fulfilled" ? results[2].value : [];
    const notifications = results[3].status === "fulfilled" ? results[3].value : [];
    const unreadCount = results[4].status === "fulfilled" ? results[4].value : 0;
    const activityRows = results[5].status === "fulfilled" ? (results[5].value as any[]) : [];

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
