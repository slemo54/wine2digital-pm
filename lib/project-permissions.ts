export type ProjectMemberRole = "owner" | "manager" | "member";

export function normalizeProjectMemberRole(role: unknown): ProjectMemberRole {
  if (role === "owner" || role === "manager" || role === "member") return role;
  return "member";
}

export function canManageProjectMembers(input: {
  globalRole?: string | null;
  projectRole?: string | null;
}): boolean {
  const globalRole = input.globalRole || "";
  if (globalRole === "admin") return true;

  const projectRole = input.projectRole || "";
  return projectRole === "owner" || projectRole === "manager";
}


