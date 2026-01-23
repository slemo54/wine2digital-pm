import { PrismaClient } from "@prisma/client";

export type TaskAccessFlags = {
  isAssignee: boolean;
  isProjectMember: boolean;
  projectRole: string | null;
};

export async function getTaskAccessFlags(
  prisma: PrismaClient,
  taskId: string,
  userId: string
): Promise<TaskAccessFlags | null> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      assignees: { select: { userId: true } },
      project: { select: { members: { select: { userId: true, role: true } } } },
    },
  });

  if (!task) return null;

  const isAssignee = task.assignees.some((a) => a.userId === userId);
  const membership = task.project.members.find((m) => m.userId === userId) || null;
  const isProjectMember = Boolean(membership);
  const projectRole = membership?.role ? String(membership.role) : null;

  return { isAssignee, isProjectMember, projectRole };
}



