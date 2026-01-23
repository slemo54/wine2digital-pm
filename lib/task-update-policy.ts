export const MEMBER_TASK_EDITABLE_KEYS = [
  "title",
  "description",
  "status",
  "priority",
  "dueDate",
] as const;

export type MemberTaskEditableKey = (typeof MEMBER_TASK_EDITABLE_KEYS)[number];

export type MemberTaskUpdateKeysValidation =
  | { ok: true }
  | { ok: false; invalidKeys: string[] };

export function validateMemberTaskUpdateKeys(body: unknown): MemberTaskUpdateKeysValidation {
  if (!body || typeof body !== "object") return { ok: true };
  const allowed = new Set<string>(MEMBER_TASK_EDITABLE_KEYS);
  const keys = Object.keys(body as Record<string, unknown>);
  const invalidKeys = keys.filter((k) => !allowed.has(k));
  if (invalidKeys.length > 0) return { ok: false, invalidKeys };
  return { ok: true };
}

export function canMemberEditSubtaskDetails(input: {
  isTaskAssignee: boolean;
  isSubtaskAssignee: boolean;
}): boolean {
  return input.isTaskAssignee || input.isSubtaskAssignee;
}

