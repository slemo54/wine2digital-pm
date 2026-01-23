import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { getTaskAccessFlags } from "@/lib/task-access";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = (session.user as any).id as string | undefined;
    const role = ((session.user as any).role as string | undefined) || "member";
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const access = await getTaskAccessFlags(prisma, params.id, userId);
    if (!access) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const canRead = role === "admin" || access.isAssignee || access.isProjectMember;
    if (!canRead) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const events = await prisma.taskActivity.findMany({
      where: { taskId: params.id },
      orderBy: { createdAt: "desc" },
      take: 200,
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
      },
    });

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Error fetching activity:", error);
    return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 });
  }
}


