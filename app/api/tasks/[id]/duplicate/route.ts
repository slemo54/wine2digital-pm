import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";

function buildDuplicateTitle(title: string, existingTitles: string[]): string {
  const baseTitle = String(title || "Task").trim() || "Task";
  const used = new Set(existingTitles.map((value) => String(value || "").trim()));

  for (let index = 1; index < 10000; index += 1) {
    const candidate = `${baseTitle}(${index})`;
    if (!used.has(candidate)) return candidate;
  }

  return `${baseTitle}(${Date.now()})`;
}

export async function POST(
  request: NextRequest,
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

    const existing = await prisma.task.findUnique({
      where: { id: params.id },
      include: {
        project: { select: { members: { select: { userId: true, role: true } } } },
        tags: { select: { id: true } },
        assignees: { select: { userId: true } },
        customFieldValues: { select: { customFieldId: true, value: true } },
        subtasks: {
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          select: {
            title: true,
            description: true,
            completed: true,
            status: true,
            priority: true,
            dueDate: true,
            position: true,
            assigneeId: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const membership = existing.project?.members?.find((m) => m.userId === userId) || null;
    const isProjectMember = Boolean(membership);
    const projectRole = membership?.role ? String(membership.role) : "";
    const isProjectManager = projectRole === "owner" || projectRole === "manager";
    const canDuplicate = role === "admin" || isProjectManager || (role === "manager" && isProjectMember);

    if (!canDuplicate) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const siblingTitles = await prisma.task.findMany({
      where: { projectId: existing.projectId, listId: existing.listId },
      select: { title: true },
    });
    const duplicateTitle = buildDuplicateTitle(existing.title, siblingTitles.map((task) => task.title));

    const duplicated = await prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          title: duplicateTitle,
          description: existing.description,
          status: existing.status,
          priority: existing.priority,
          dueDate: existing.dueDate,
          position: existing.position + 1,
          projectId: existing.projectId,
          listId: existing.listId,
          storyPoints: existing.storyPoints,
          amountCents: existing.amountCents,
          legacyTags: existing.legacyTags,
          list: existing.list,
          tags: existing.tags.length > 0 ? { connect: existing.tags.map((tag) => ({ id: tag.id })) } : undefined,
          assignees:
            existing.assignees.length > 0
              ? { create: existing.assignees.map((assignee) => ({ userId: assignee.userId })) }
              : undefined,
          customFieldValues:
            existing.customFieldValues.length > 0
              ? {
                create: existing.customFieldValues.map((fieldValue) => ({
                  customFieldId: fieldValue.customFieldId,
                  value: fieldValue.value,
                })),
              }
              : undefined,
          subtasks:
            existing.subtasks.length > 0
              ? {
                create: existing.subtasks.map((subtask) => ({
                  title: subtask.title,
                  description: subtask.description,
                  completed: false,
                  status: "todo",
                  priority: subtask.priority,
                  dueDate: subtask.dueDate,
                  position: subtask.position,
                  assigneeId: subtask.assigneeId,
                })),
              }
              : undefined,
        },
        include: {
          taskList: { select: { id: true, name: true } },
          tags: { select: { id: true, name: true, color: true } },
          assignees: {
            include: {
              user: {
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
          },
          _count: { select: { comments: true, attachments: true, subtasks: true } },
        },
      });

      await tx.taskActivity.create({
        data: {
          taskId: task.id,
          actorId: userId,
          type: "task.duplicated",
          metadata: { sourceTaskId: existing.id, sourceTitle: existing.title },
        },
      });

      return task;
    });

    return NextResponse.json({ task: duplicated }, { status: 201 });
  } catch (error) {
    console.error("Error duplicating task:", error);
    return NextResponse.json({ error: "Failed to duplicate task" }, { status: 500 });
  }
}
