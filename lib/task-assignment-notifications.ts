export type NotificationInput = {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
};

export function normalizeUserIdList(input: unknown): string[] | null {
  if (input === undefined) return [];
  if (!Array.isArray(input)) return null;
  return Array.from(
    new Set(
      input
        .map((x) => (x === null || x === undefined ? "" : String(x)).trim())
        .filter(Boolean)
    )
  );
}

export function getAddedAssigneeIds(opts: {
  prevAssigneeIds: string[];
  nextAssigneeIds: string[];
  actorUserId: string;
}): string[] {
  const prev = new Set(opts.prevAssigneeIds.map(String));
  const actor = String(opts.actorUserId || "");
  return opts.nextAssigneeIds
    .map(String)
    .filter((id) => id && id !== actor && !prev.has(id));
}

export function buildTaskAssignedNotifications(opts: {
  assigneeIds: string[];
  actorLabel: string;
  taskId: string;
  taskTitle: string;
  projectName?: string | null;
}): NotificationInput[] {
  const link = `/tasks?taskId=${encodeURIComponent(opts.taskId)}`;
  const actor = String(opts.actorLabel || "Un collega");
  const title = "Sei stato assegnato a una task";
  const proj = opts.projectName ? ` (${String(opts.projectName)})` : "";
  const message = `${actor} ti ha assegnato: ${String(opts.taskTitle || "Task")}${proj}`;
  return opts.assigneeIds.map((uid) => ({
    userId: uid,
    type: "task_assigned",
    title,
    message,
    link,
  }));
}

