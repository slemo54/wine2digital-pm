export function canReadWiki(input: { globalRole?: string | null; isProjectMember: boolean }): boolean {
  if ((input.globalRole || "") === "admin") return true;
  return input.isProjectMember;
}

export function canWriteWiki(input: { globalRole?: string | null; projectRole?: string | null }): boolean {
  const globalRole = input.globalRole || "";
  if (globalRole === "admin") return true;
  const projectRole = input.projectRole || "";
  // MVP: allow any project member to write; if vuoi restringere, cambia qui a owner/manager.
  return projectRole === "owner" || projectRole === "manager" || projectRole === "member";
}


