export type GlobalRole = "admin" | "manager" | "member";

export type ClockifyVisibility =
  | { kind: "all" }
  | { kind: "department"; department: string }
  | { kind: "self"; userId: string };

import { normalizeDepartment } from "./departments";

export function getClockifyVisibility(input: {
  globalRole: GlobalRole;
  userId: string;
  department: string | null;
}): ClockifyVisibility {
  if (input.globalRole === "admin") return { kind: "all" };
  if (input.globalRole === "member") return { kind: "self", userId: input.userId };

  const department = normalizeDepartment(input.department);
  if (!department) return { kind: "self", userId: input.userId };
  return { kind: "department", department };
}

