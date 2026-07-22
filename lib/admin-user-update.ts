export type AdminUserUpdate = {
  role?: "admin" | "manager" | "member";
  isActive?: boolean;
  calendarEnabled?: boolean;
  department?: string | null;
};

type AdminUserAuditState = {
  role: string;
  isActive: boolean;
  department: string | null;
  calendarEnabled: boolean;
};

const SUPPORTED_FIELDS = ["role", "isActive", "calendarEnabled", "department"] as const;

export function parseAdminUserUpdate(body: unknown):
  | { ok: true; value: AdminUserUpdate }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Request body must be an object" };
  }

  const record = body as Record<string, unknown>;
  const unsupportedFields = Object.keys(record).filter(
    (key) => !SUPPORTED_FIELDS.includes(key as (typeof SUPPORTED_FIELDS)[number]),
  );
  if (unsupportedFields.length > 0) {
    return { ok: false, error: `Unsupported fields: ${unsupportedFields.sort().join(", ")}` };
  }

  if (Object.keys(record).length === 0) {
    return { ok: false, error: "No supported fields supplied" };
  }

  const value: AdminUserUpdate = {};
  if (record.role !== undefined) {
    if (record.role !== "admin" && record.role !== "manager" && record.role !== "member") {
      return { ok: false, error: "Invalid role" };
    }
    value.role = record.role;
  }
  if (record.isActive !== undefined) {
    if (typeof record.isActive !== "boolean") {
      return { ok: false, error: "isActive must be a boolean" };
    }
    value.isActive = record.isActive;
  }
  if (record.calendarEnabled !== undefined) {
    if (typeof record.calendarEnabled !== "boolean") {
      return { ok: false, error: "calendarEnabled must be a boolean" };
    }
    value.calendarEnabled = record.calendarEnabled;
  }
  if (record.department !== undefined) {
    if (record.department !== null && typeof record.department !== "string") {
      return { ok: false, error: "department must be a string or null" };
    }
    value.department = record.department;
  }

  return { ok: true, value };
}

export function wouldDisableLastActiveAdmin(input: {
  target: { role: string; isActive: boolean };
  patch: AdminUserUpdate;
  activeAdminCount: number;
}): boolean {
  if (input.target.role !== "admin" || !input.target.isActive || input.activeAdminCount > 1) {
    return false;
  }

  return input.patch.isActive === false || (input.patch.role !== undefined && input.patch.role !== "admin");
}

export function buildAdminUserAuditChanges(
  previous: AdminUserAuditState,
  current: AdminUserAuditState,
): Record<string, { old: string | boolean | null; new: string | boolean | null }> {
  const changes: Record<string, { old: string | boolean | null; new: string | boolean | null }> = {};
  const fields: Array<keyof AdminUserAuditState> = ["role", "isActive", "department", "calendarEnabled"];

  for (const field of fields) {
    if (previous[field] !== current[field]) {
      changes[field] = { old: previous[field], new: current[field] };
    }
  }

  return changes;
}
