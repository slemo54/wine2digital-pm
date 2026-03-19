import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { formatTaskActivityEvent } from "@/lib/task-activity-format";

export const dynamic = "force-dynamic";

/**
 * API Endpoint unificato per il dashboard.
 * Riduce il numero di round-trip da 5 a 1.
 * Utilizza Promise.allSettled per garantire la resilienza.
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

    // Esecuzione parallela di tutte le query necessarie per la dashboard
    const results = await Promise.allSettled([
      // 1. Progetti
      prisma.project.findMany({
        where: {
          OR: [{ creatorId: userId }, { members: { some: { userId } } }],
          status: "active",
        },
        include: {
          _count: { select: { tasks: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 10,
      }),

      // 2. Task assegnati
      prisma.task.findMany({
        where: {
          assignees: { some: { userId } },
          status: { not: "done" },
        },
        include: {
          project: { select: { id: true, name: true } },
        },
        orderBy: { dueDate: "asc" },
        take: 20,
      }),

      // 3. Subtask assegnati
      prisma.subtask.findMany({
        where: {
          assigneeId: userId,
          status: { not: "done" },
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
        orderBy: { dueDate: "asc" },
        take: 20,
      }),

      // 4. Notifiche (ultime 50 + conteggio non lette)
      Promise.all([
        prisma.notification.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
        prisma.notification.count({
          where: { userId, isRead: false },
        }),
      ]),

      // 5. Attività recente (ultime 25)
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
      }),
    ]);

    // Estrazione dei dati con gestione degli errori per singola query
    const projects = results[0].status === "fulfilled" ? results[0].value : [];
    const tasks = results[1].status === "fulfilled" ? results[1].value : [];
    const subtasks = results[2].status === "fulfilled" ? results[2].value : [];

    const notificationsData = results[3].status === "fulfilled" ? results[3].value : [[], 0];
    const notifications = notificationsData[0];
    const unreadCount = notificationsData[1];

    const activityRows = results[4].status === "fulfilled" ? (results[4].value as any[]) : [];
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
