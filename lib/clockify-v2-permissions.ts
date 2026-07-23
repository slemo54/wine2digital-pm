export type ClockifyGlobalRole = "admin" | "manager" | "member";

export type ClockifyReportScope =
  | { kind: "all" }
  | { kind: "department"; department: string }
  | { kind: "self"; userId: string };

export function canAccessClockifyAdmin(role: ClockifyGlobalRole): boolean {
  return role === "admin" || role === "manager";
}

export function canManageClockifyProject(input: {
  role: ClockifyGlobalRole;
  userId: string;
  createdById: string | null;
  managerId: string | null;
}): boolean {
  if (input.role === "admin") return true;
  if (input.role !== "manager") return false;

  return input.createdById === input.userId || input.managerId === input.userId;
}

export function canMutateClockifyEntry(input: {
  actorId: string;
  entryUserId: string;
  isLocked: boolean;
  isDeleted: boolean;
}): boolean {
  return input.actorId === input.entryUserId && !input.isLocked && !input.isDeleted;
}

export function canManageClockifyLocks(role: ClockifyGlobalRole): boolean {
  return role === "admin";
}

export function getClockifyReportScope(input: {
  role: ClockifyGlobalRole;
  userId: string;
  department: string | null;
}): ClockifyReportScope {
  if (input.role === "admin") return { kind: "all" };

  if (input.role === "manager" && input.department?.trim()) {
    return { kind: "department", department: input.department };
  }

  return { kind: "self", userId: input.userId };
}
