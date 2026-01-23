import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";
import { formatTaskActivityEvent } from "@/lib/task-activity-format";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    const me = await getSessionUser();
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rows = await prisma.taskActivity.findMany({
      where: {
        task: {
          OR: [
            { assignees: { some: { userId: me.id } } },
            { project: { members: { some: { userId: me.id } } } },
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

    const events = rows.map((r) => {
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

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Activity feed error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}


