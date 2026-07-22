import { canManageClockifyProject, type ClockifyGlobalRole } from "./clockify-v2-permissions";

export type ClockifyCatalogActor = { role: ClockifyGlobalRole; userId: string };
export type ClockifyCatalogProject = {
  id: string;
  createdById: string | null;
  managerId: string | null;
  origin: string;
};

export class ClockifyCatalogError extends Error {
  constructor(
    public readonly status: 400 | 403 | 404 | 409,
    message: string
  ) {
    super(message);
  }
}

export function normalizeClockifyName(input: unknown): string {
  const name = String(input ?? "").normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!name) throw new ClockifyCatalogError(400, "Name is required");
  return name.toLocaleLowerCase("it-IT");
}

export function displayClockifyName(input: unknown): string {
  const name = String(input ?? "").normalize("NFKC").trim().replace(/\s+/g, " ");
  if (!name) throw new ClockifyCatalogError(400, "Name is required");
  return name;
}

export function normalizeClockifyColor(input: unknown): string {
  const color = String(input ?? "#6B7280").trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw new ClockifyCatalogError(400, "Color must be a six-digit hex value");
  }
  return color.toUpperCase();
}

export function canManageCatalogProject(actor: ClockifyCatalogActor, project: ClockifyCatalogProject): boolean {
  return canManageClockifyProject({
    role: actor.role,
    userId: actor.userId,
    createdById: project.createdById,
    managerId: project.managerId,
  });
}

export function canAssignClockifyManager(role: ClockifyGlobalRole): boolean {
  return role === "admin";
}

export function createClockifyProjectInput(
  actor: ClockifyCatalogActor,
  input: { name: unknown; client: { id: string; name: unknown }; color?: unknown; managerId?: unknown }
): {
  name: string;
  clientId: string;
  client: string;
  color: string;
  origin: "manual";
  createdById: string;
  managerId: string | null;
} {
  const clientId = String(input.client?.id ?? "").trim();
  if (!clientId) throw new ClockifyCatalogError(400, "Client is required");
  const managerId = String(input.managerId ?? "").trim() || null;
  if (managerId && !canAssignClockifyManager(actor.role)) {
    throw new ClockifyCatalogError(403, "Only admins can assign a manager");
  }
  return {
    name: displayClockifyName(input.name),
    clientId,
    client: displayClockifyName(input.client.name),
    color: normalizeClockifyColor(input.color),
    origin: "manual",
    createdById: actor.userId,
    managerId,
  };
}

export function projectArchivePatch(actorId: string, archivedAt = new Date()): {
  isActive: false;
  archivedAt: Date;
  archivedById: string;
} {
  return { isActive: false, archivedAt, archivedById: actorId };
}

export function projectRestorePatch(): { isActive: true; archivedAt: null; archivedById: null } {
  return { isActive: true, archivedAt: null, archivedById: null };
}

export function taskStatusPatch(isActive: boolean): { isActive: boolean } {
  return { isActive };
}

export function assertCatalogProjectAccess(actor: ClockifyCatalogActor, project: ClockifyCatalogProject | null): ClockifyCatalogProject {
  if (!project || !canManageCatalogProject(actor, project)) {
    throw new ClockifyCatalogError(404, "Project not found");
  }
  return project;
}

export function isPrismaUniqueError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}
