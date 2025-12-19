export function isEffectivelyEmptyRichContent(html: string): boolean {
  const hasImage = /<img\b/i.test(html);
  const text = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return !hasImage && !text;
}

export function normalizeMentionedUserIds(input: unknown, selfUserId: string): string[] {
  if (!Array.isArray(input)) return [];
  const normalized = input
    .map((x) => String(x || "").trim())
    .filter((x) => x && x !== selfUserId);
  return Array.from(new Set(normalized));
}

export type MentionNotificationInput = {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
};

export function buildMentionNotifications(opts: {
  mentionedUserIds: string[];
  authorLabel: string;
  taskId: string;
  subtaskId: string;
  taskTitle: string;
  subtaskTitle: string;
}): MentionNotificationInput[] {
  const link = `/tasks?taskId=${encodeURIComponent(opts.taskId)}&subtaskId=${encodeURIComponent(opts.subtaskId)}`;
  return opts.mentionedUserIds.map((uid) => ({
    userId: uid,
    type: "subtask_mentioned",
    title: "Sei stato menzionato",
    message: `${opts.authorLabel} ti ha menzionato in: ${opts.subtaskTitle} (task: ${opts.taskTitle})`,
    link,
  }));
}


