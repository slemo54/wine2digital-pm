import sanitizeHtml from "sanitize-html";

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

const ALLOWED_RICH_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
  "a",
  "span",
  "img",
] as const;

const ALLOWED_RICH_ATTRS: Record<string, string[]> = {
  a: ["href", "target", "rel"],
  span: ["class", "data-type", "data-id", "data-label"],
  img: ["src", "alt", "title", "width", "height"],
};

export function sanitizeRichHtml(input: string): string {
  const html = typeof input === "string" ? input : "";

  const cleaned = sanitizeHtml(html, {
    allowedTags: [...ALLOWED_RICH_TAGS],
    allowedAttributes: ALLOWED_RICH_ATTRS,
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      img: ["http", "https"],
    },
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => {
        const next = { ...attribs, rel: "noreferrer", target: "_blank" };
        return { tagName, attribs: next };
      },
    },
    exclusiveFilter: (frame) => {
      // Remove empty paragraphs/spans after sanitization
      if (frame.tag === "p" || frame.tag === "span") {
        const text = String(frame.text || "").replace(/\s+/g, " ").trim();
        return !text;
      }
      return false;
    },
  }).trim();

  return cleaned;
}

export function filterMentionedUserIdsToAllowed(mentionedUserIds: string[], allowedUserIds: string[]): string[] {
  if (mentionedUserIds.length === 0) return [];
  const allowed = new Set(allowedUserIds);
  return mentionedUserIds.filter((id) => allowed.has(id));
}


