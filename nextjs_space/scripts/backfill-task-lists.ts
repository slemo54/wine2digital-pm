import { PrismaClient } from "@prisma/client";

const DEFAULT_LIST_NAME = "Untitled list";

function normalizeListName(input: unknown): string {
  if (typeof input !== "string") return DEFAULT_LIST_NAME;
  const trimmed = input.trim();
  return trimmed ? trimmed : DEFAULT_LIST_NAME;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const projects = await prisma.project.findMany({ select: { id: true, name: true } });
    let updatedTasks = 0;
    let createdLists = 0;

    for (const project of projects) {
      // Ensure default list exists
      const defaultList = await prisma.taskList.upsert({
        where: { projectId_name: { projectId: project.id, name: DEFAULT_LIST_NAME } },
        create: { projectId: project.id, name: DEFAULT_LIST_NAME },
        update: {},
      });

      const tasks = await prisma.task.findMany({
        where: { projectId: project.id },
        select: { id: true, list: true, listId: true },
      });

      const byName = new Map<string, string>();
      byName.set(DEFAULT_LIST_NAME, defaultList.id);

      for (const task of tasks) {
        if (task.listId) continue;

        const name = normalizeListName(task.list);
        let listId = byName.get(name);

        if (!listId) {
          const list = await prisma.taskList.upsert({
            where: { projectId_name: { projectId: project.id, name } },
            create: { projectId: project.id, name },
            update: {},
          });
          listId = list.id;
          byName.set(name, listId);
          createdLists += 1;
        }

        await prisma.task.update({
          where: { id: task.id },
          data: { listId },
        });
        updatedTasks += 1;
      }
    }

    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ ok: true, updatedTasks, createdLists }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});


