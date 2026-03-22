import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { formatTaskActivityEvent } from "@/lib/task-activity-format";

export const dynamic = "force-dynamic";

/**
 * API Endpoint unificato per la dashboard
 * Riduce 5 chiamate HTTP a 1, eseguendo le query Prisma in parallelo sul server.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id as string;

  try {
    // Eseguiamo tutte le query in parallelo per massimizzare le performance
    const results = await Promise.allSettled([
      // 1. Progetti
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

      // 2. Task assegnati
      prisma.task.findMany({
        where: {
          assignees: { some: { userId } },
          status: { not: "archived" },
        },
        include: {
          project: { select: { id: true, name: true } },
          _count: { select: { comments: true, attachments: true, subtasks: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
      }),

      // 3. Subtask assegnati
      prisma.subtask.findMany({
        where: {
          assigneeId: userId,
          status: { not: "archived" },
        },
        include: {
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

      // 4. Notifiche
      Promise.all([
        prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        prisma.notification.count({
          where: { userId, isRead: false },
        }),
      ]),

      // 5. Activity Log
      prisma.taskActivity.findMany({
        where: {
          task: {
            OR: [
              { assignees: { some: { userId: userId } } },
              { project: { members: { some: { userId: userId } } } },
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

    // Estrazione sicura dei risultati
    const projects = results[0].status === "fulfilled" ? (results[0].value as any[]) : [];
    const tasks = results[1].status === "fulfilled" ? (results[1].value as any[]) : [];
    const subtasks = results[2].status === "fulfilled" ? (results[2].value as any[]) : [];

    const notificationsData = results[3].status === "fulfilled" ? (results[3].value as [any[], number]) : [[], 0];
    const notifications = notificationsData[0];
    const unreadCount = notificationsData[1];

    const activityRows = results[4].status === "fulfilled" ? (results[4].value as any[]) : [];
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
      projects: { projects },
      tasks: { tasks },
      subtasks: { subtasks },
      notifications: { notifications, unreadCount },
      activity: { events },
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard summary" },
      { status: 500 }
    );
  }
}
