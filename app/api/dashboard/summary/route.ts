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

    const userId = (session.user as any).id as string;
    const role = ((session.user as any).role as string) || "member";

    // 1. PROJECTS
    const projectsPromise = prisma.project.findMany({
      where: {
        OR: [{ creatorId: userId }, { members: { some: { userId } } }],
      },
      include: {
        _count: { select: { tasks: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10, // Dashboard usually only shows the first few
    });

    // 2. TASKS (Assigned)
    const tasksPromise = prisma.task.findMany({
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
    });

    // 3. SUBTASKS (Assigned)
    const subtasksPromise = prisma.subtask.findMany({
      where: {
        assigneeId: userId,
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
    });

    // 4. NOTIFICATIONS
    const notificationsPromise = prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const unreadCountPromise = prisma.notification.count({
      where: { userId, isRead: false },
    });

    // 5. ACTIVITY
    const activityPromise = prisma.taskActivity.findMany({
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
    });

    // Parallel fetch
    const results = await Promise.allSettled([
      projectsPromise,
      tasksPromise,
      subtasksPromise,
      notificationsPromise,
      unreadCountPromise,
      activityPromise,
    ]);

    const getResult = <T>(index: number, defaultValue: T): T => {
      const result = results[index];
      return result.status === "fulfilled" ? (result.value as T) : defaultValue;
    };

    const projects = getResult(0, []);
    const tasks = getResult(1, []);
    const subtasks = getResult(2, []);
    const notificationsRaw = getResult(3, []);
    const unreadCount = getResult(4, 0);
    const activityRows = getResult(5, []);

    // Format activity
    const activityEvents = activityRows.map((r: any) => {
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
      projects: projects.map((p: any) => ({ ...p, status: p.status === 'active' ? 'running' : p.status })),
      tasks,
      subtasks,
      notifications: notificationsRaw,
      unreadCount,
      activity: activityEvents,
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
