import type { ClockifyV2Actor } from "./clockify-v2-api";
import { canonicalizeClockifyActor } from "./clockify-v2-entries";
import { getClockifyReportScope } from "./clockify-v2-permissions";

type Db = any;

type CatalogUser = { id: string; name: string | null; email: string; department: string | null };
type CatalogProject = {
  id: string;
  name: string;
  client: string;
  clientId: string | null;
  color: string;
  isActive: boolean;
  archivedAt: Date | null;
};
type CatalogTask = { id: string; name: string; projectId: string; isActive: boolean };

export type ClockifyReportCatalog = {
  departments: string[];
  users: CatalogUser[];
  clients: Array<{ id: string | null; name: string }>;
  projects: Array<{ id: string; name: string; client: string; clientId: string | null; color: string; active: boolean; archived: boolean }>;
  tasks: Array<{ id: string; name: string; projectId: string; active: boolean }>;
  tags: string[];
};

function byLabel<T>(getLabel: (value: T) => string) {
  return (left: T, right: T) => getLabel(left).localeCompare(getLabel(right), "it-IT", { sensitivity: "base" });
}

/**
 * Returns only values that are historically reachable through entries inside
 * the actor's report scope. This keeps archived projects useful without
 * leaking people or identifiers from another department.
 */
export async function getClockifyReportCatalog(db: Db, actor: ClockifyV2Actor): Promise<ClockifyReportCatalog> {
  const canonical = await canonicalizeClockifyActor(actor);
  const scope = getClockifyReportScope(canonical);
  const scopeWhere = scope.kind === "all"
    ? {}
    : scope.kind === "department"
      ? { user: { department: { equals: scope.department, mode: "insensitive" } } }
      : { userId: scope.userId };
  const where = { deletedAt: null, ...scopeWhere };
  // DISTINCT queries keep the catalog complete for historical data without
  // loading every entry into application memory.
  const [userRows, projectRows, taskRows, tagRows]: [
    Array<{ user: CatalogUser }>,
    Array<{ project: CatalogProject }>,
    Array<{ clockifyTask: CatalogTask | null }>,
    Array<{ tags: string[] }>,
  ] = await Promise.all([
    db.clockifyEntry.findMany({
      where,
      distinct: ["userId"],
      select: { user: { select: { id: true, name: true, email: true, department: true } } },
    }),
    db.clockifyEntry.findMany({
      where,
      distinct: ["projectId"],
      select: { project: { select: { id: true, name: true, client: true, clientId: true, color: true, isActive: true, archivedAt: true } } },
    }),
    db.clockifyEntry.findMany({
      where: { ...where, taskId: { not: null } },
      distinct: ["taskId"],
      select: { clockifyTask: { select: { id: true, name: true, projectId: true, isActive: true } } },
    }),
    db.clockifyEntry.findMany({
      where,
      distinct: ["tags"],
      select: { tags: true },
    }),
  ]);

  const users = new Map<string, CatalogUser>();
  const clients = new Map<string, { id: string | null; name: string }>();
  const projects = new Map<string, ClockifyReportCatalog["projects"][number]>();
  const tasks = new Map<string, ClockifyReportCatalog["tasks"][number]>();
  const departments = new Set<string>();
  const tags = new Set<string>();

  for (const row of userRows) {
    users.set(row.user.id, row.user);
    if (row.user.department?.trim()) departments.add(row.user.department.trim());
  }
  for (const row of projectRows) {
    const clientName = row.project.client?.trim() || "Senza cliente";
    clients.set(row.project.clientId || clientName.toLocaleLowerCase("it-IT"), { id: row.project.clientId, name: clientName });
    projects.set(row.project.id, {
      id: row.project.id,
      name: row.project.name,
      client: clientName,
      clientId: row.project.clientId,
      color: row.project.color,
      active: row.project.isActive && !row.project.archivedAt,
      archived: Boolean(row.project.archivedAt || !row.project.isActive),
    });
  }
  for (const row of taskRows) {
    if (row.clockifyTask) tasks.set(row.clockifyTask.id, {
      id: row.clockifyTask.id,
      name: row.clockifyTask.name,
      projectId: row.clockifyTask.projectId,
      active: row.clockifyTask.isActive,
    });
  }
  for (const row of tagRows) {
    for (const rawTag of row.tags || []) {
      const tag = rawTag.normalize("NFKC").trim();
      if (tag) tags.add(tag);
    }
  }

  return {
    departments: [...departments].sort((a, b) => a.localeCompare(b, "it-IT", { sensitivity: "base" })),
    users: [...users.values()].sort(byLabel((user) => user.name || user.email)),
    clients: [...clients.values()].sort(byLabel((client) => client.name)),
    projects: [...projects.values()].sort(byLabel((project) => `${project.client} ${project.name}`)),
    tasks: [...tasks.values()].sort(byLabel((task) => task.name)),
    tags: [...tags].sort((a, b) => a.localeCompare(b, "it-IT", { sensitivity: "base" })),
  };
}
