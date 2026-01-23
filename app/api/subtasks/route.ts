import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = (session.user as any).id as string | undefined;
    const role = ((session.user as any).role as string | undefined) || "member";
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const scope = String(searchParams.get("scope") || "assigned");

    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const projectId = searchParams.get("projectId");
    const dueFrom = searchParams.get("dueFrom");
    const dueTo = searchParams.get("dueTo");
    const q = searchParams.get("q");

    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSizeRaw = Number(searchParams.get("pageSize") || 50);
    const pageSize = Math.min(200, Math.max(1, pageSizeRaw));
    const skip = (page - 1) * pageSize;

    if (scope !== "assigned") {
      return NextResponse.json({ error: "Unsupported scope" }, { status: 400 });
    }

    const accessFilter =
      role === "admin"
        ? {}
        : {
            OR: [
              { task: { assignees: { some: { userId } } } },
              { task: { project: { members: { some: { userId } } } } },
            ],
          };

    const where = {
      AND: [
        { assigneeId: userId },
        accessFilter,
        status && status !== "all" ? { status } : {},
        priority && priority !== "all" ? { priority } : {},
        projectId && projectId !== "all" ? { task: { projectId } } : {},
        dueFrom || dueTo
          ? {
              dueDate: {
                ...(dueFrom ? { gte: new Date(dueFrom) } : {}),
                ...(dueTo ? { lte: new Date(dueTo) } : {}),
              },
            }
          : {},
        q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" as const } },
                { task: { title: { contains: q, mode: "insensitive" as const } } },
              ],
            }
          : {},
      ],
    } as const;

    const [total, subtasks] = await Promise.all([
      prisma.subtask.count({ where: where as any }),
      prisma.subtask.findMany({
        where: where as any,
        orderBy: [{ updatedAt: "desc" }],
        skip,
        take: pageSize,
        select: {
          id: true,
          taskId: true,
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          createdAt: true,
          updatedAt: true,
          task: {
            select: {
              id: true,
              title: true,
              project: { select: { id: true, name: true } },
            },
          },
        },
      }),
    ]);

    return NextResponse.json({ subtasks, page, pageSize, total });
  } catch (error) {
    console.error("List subtasks error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

