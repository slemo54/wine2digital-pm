import { PrismaClient } from "@prisma/client";

export type TaskAccessFlags = {
  isAssignee: boolean;
  isProjectMember: boolean;
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
      project: { select: { members: { select: { userId: true } } } },
    },
  });

  if (!task) return null;

  const isAssignee = task.assignees.some((a) => a.userId === userId);
  const isProjectMember = task.project.members.some((m) => m.userId === userId);

  return { isAssignee, isProjectMember };
}


