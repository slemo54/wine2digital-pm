import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { getTaskAccessFlags } from "@/lib/task-access";
import { prisma } from "@/lib/prisma";
import { validateSubtaskDependencyCreation } from "@/lib/subtask-dependencies";

export async function POST(
  request: NextRequest,
  { params }: { params: { subtaskId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const userId = (session.user as any).id as string | undefined;
    const role = ((session.user as any).role as string | undefined) || "member";
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const dependsOnId = typeof (body as any)?.dependsOnId === "string" ? String((body as any).dependsOnId).trim() : "";
    if (!dependsOnId) return NextResponse.json({ error: "Missing dependsOnId" }, { status: 400 });
    if (params.subtaskId === dependsOnId) {
      return NextResponse.json({ error: "Cannot depend on self" }, { status: 400 });
    }

    const [subtask, dependsOn] = await Promise.all([
      prisma.subtask.findUnique({ where: { id: params.subtaskId }, select: { id: true, taskId: true } }),
      prisma.subtask.findUnique({ where: { id: dependsOnId }, select: { id: true, taskId: true } }),
    ]);
    if (!subtask) return NextResponse.json({ error: "Subtask not found" }, { status: 404 });
    if (!dependsOn) return NextResponse.json({ error: "DependsOn subtask not found" }, { status: 404 });

    const access = await getTaskAccessFlags(prisma, subtask.taskId, userId);
    if (!access) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    const isProjectManager = access.projectRole === "owner" || access.projectRole === "manager";
    const canWrite =
      role === "admin" ||
      isProjectManager ||
      (role === "manager" && access.isProjectMember) ||
      (role === "member" && access.isAssignee);
    if (!canWrite) return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });

    const existingDeps = await prisma.subtaskDependency.findMany({
      where: { subtask: { taskId: subtask.taskId } },
      select: { subtaskId: true, dependsOnId: true },
    });
    const validation = validateSubtaskDependencyCreation({
      subtaskId: params.subtaskId,
      dependsOnId,
      subtaskTaskId: subtask.taskId,
      dependsOnTaskId: dependsOn.taskId,
      existingEdges: existingDeps,
    });
    if (!validation.ok) {
      const msg =
        validation.error === "self_dependency"
          ? "Cannot depend on self"
          : validation.error === "cross_task"
            ? "Cross-task dependencies are not allowed"
            : validation.error === "cycle"
              ? "Dependency would create a cycle"
              : "Missing dependsOnId";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const dependency = await prisma.subtaskDependency.create({
      data: { subtaskId: params.subtaskId, dependsOnId },
    });

    return NextResponse.json(dependency, { status: 201 });
  } catch (error) {
    // Unique constraint on (subtaskId, dependsOnId)
    if (error && typeof error === "object" && "code" in error && (error as any).code === "P2002") {
      return NextResponse.json({ error: "Dependency already exists" }, { status: 409 });
    }
    console.error("Error adding dependency:", error);
    return NextResponse.json({ error: "Failed to add dependency" }, { status: 500 });
  }
}
