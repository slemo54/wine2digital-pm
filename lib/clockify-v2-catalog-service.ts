import type { ClockifyV2Actor } from "./clockify-v2-api";
import {
  assertCatalogProjectAccess,
  canAssignClockifyManager,
  ClockifyCatalogError,
  createClockifyProjectInput,
  displayClockifyName,
  isPrismaUniqueError,
  normalizeClockifyColor,
  normalizeClockifyName,
  projectArchivePatch,
  projectRestorePatch,
  taskStatusPatch,
} from "./clockify-v2-catalog";

type Db = any;

const projectSelect = {
  id: true, name: true, client: true, clientId: true, color: true, origin: true, isActive: true,
  createdById: true, managerId: true, archivedAt: true, archivedById: true, createdAt: true, updatedAt: true,
  clientRecord: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  manager: { select: { id: true, name: true, email: true } },
};

async function audit(db: Db, actorId: string, actionType: string, entityType: string, entityId: string, metadata?: Record<string, unknown>): Promise<void> {
  await db.auditLog.create({ data: { actorId, actionType, entityType, entityId, metadata } });
}

function rethrowCatalogError(error: unknown): never {
  if (error instanceof ClockifyCatalogError) throw error;
  if (isPrismaUniqueError(error)) throw new ClockifyCatalogError(409, "A catalog item with this normalized name already exists");
  throw error;
}

export async function listClockifyClients(db: Db, q = ""): Promise<unknown[]> {
  return db.clockifyClient.findMany({
    where: q ? { name: { contains: q, mode: "insensitive" } } : {},
    orderBy: { name: "asc" },
    take: 200,
    select: { id: true, name: true, normalizedName: true, createdAt: true, updatedAt: true },
  });
}

export async function createClockifyClient(db: Db, actor: ClockifyV2Actor, input: { name: unknown }): Promise<unknown> {
  const name = displayClockifyName(input.name);
  const normalizedName = normalizeClockifyName(name);
  try {
    const existing = await db.clockifyClient.findUnique({ where: { normalizedName }, select: { id: true } });
    if (existing) throw new ClockifyCatalogError(409, "A client with this normalized name already exists");
    const client = await db.clockifyClient.create({ data: { name, normalizedName, createdById: actor.userId } });
    await audit(db, actor.userId, "clockify.client.create", "ClockifyClient", client.id, { name });
    return client;
  } catch (error) { rethrowCatalogError(error); }
}

export async function updateClockifyClient(db: Db, actor: ClockifyV2Actor, clientId: string, input: { name: unknown }): Promise<unknown> {
  const name = displayClockifyName(input.name);
  const normalizedName = normalizeClockifyName(name);
  try {
    const existing = await db.clockifyClient.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!existing) throw new ClockifyCatalogError(404, "Client not found");
    const duplicate = await db.clockifyClient.findFirst({ where: { normalizedName, NOT: { id: clientId } }, select: { id: true } });
    if (duplicate) throw new ClockifyCatalogError(409, "A client with this normalized name already exists");
    // Keep the legacy string used by the unchanged V1 reporting UI in sync with the V2 relation.
    const [client] = await db.$transaction([
      db.clockifyClient.update({ where: { id: clientId }, data: { name, normalizedName } }),
      db.clockifyProject.updateMany({ where: { clientId }, data: { client: name } }),
      db.auditLog.create({ data: { actorId: actor.userId, actionType: "clockify.client.update", entityType: "ClockifyClient", entityId: clientId, metadata: { name } } }),
    ]);
    return client;
  } catch (error) { rethrowCatalogError(error); }
}

export async function listClockifyProjects(db: Db, actor: ClockifyV2Actor, input: { q?: string; status?: string; clientId?: string }): Promise<unknown[]> {
  const status = input.status === "archived" ? "archived" : input.status === "all" ? "all" : "active";
  const scope = actor.role === "admin" ? {} : { OR: [{ createdById: actor.userId }, { managerId: actor.userId }] };
  return db.clockifyProject.findMany({
    where: { AND: [scope, status === "all" ? {} : { isActive: status === "active" }, input.clientId ? { clientId: input.clientId } : {}, input.q ? { OR: [{ name: { contains: input.q, mode: "insensitive" } }, { client: { contains: input.q, mode: "insensitive" } }] } : {}] },
    orderBy: [{ isActive: "desc" }, { name: "asc" }], take: 300, select: projectSelect,
  });
}

async function requireClient(db: Db, clientId: string): Promise<{ id: string; name: string }> {
  const client = await db.clockifyClient.findUnique({ where: { id: clientId }, select: { id: true, name: true } });
  if (!client) throw new ClockifyCatalogError(404, "Client not found");
  return client;
}

async function validateManager(db: Db, managerId: string | null): Promise<void> {
  if (!managerId) return;
  const manager = await db.user.findUnique({ where: { id: managerId }, select: { role: true, isActive: true } });
  if (!manager || !manager.isActive || (manager.role !== "manager" && manager.role !== "admin")) {
    throw new ClockifyCatalogError(400, "Responsible manager must be an active manager or admin");
  }
}

export async function createClockifyProject(db: Db, actor: ClockifyV2Actor, input: { name: unknown; clientId: unknown; color?: unknown; managerId?: unknown }): Promise<unknown> {
  const client = await requireClient(db, String(input.clientId ?? "").trim());
  const data = createClockifyProjectInput(actor, { name: input.name, client, color: input.color, managerId: input.managerId });
  await validateManager(db, data.managerId);
  try {
    const duplicate = await db.clockifyProject.findFirst({ where: { name: data.name, client: data.client }, select: { id: true } });
    if (duplicate) throw new ClockifyCatalogError(409, "A project with this client and name already exists");
    const project = await db.clockifyProject.create({ data, select: projectSelect });
    await audit(db, actor.userId, "clockify.project.create", "ClockifyProject", project.id, { clientId: data.clientId, origin: data.origin });
    return project;
  } catch (error) { rethrowCatalogError(error); }
}

async function managedProject(db: Db, actor: ClockifyV2Actor, projectId: string): Promise<any> {
  const project = await db.clockifyProject.findUnique({ where: { id: projectId }, select: projectSelect });
  return assertCatalogProjectAccess(actor, project);
}

export async function updateClockifyProject(db: Db, actor: ClockifyV2Actor, projectId: string, input: { name?: unknown; clientId?: unknown; color?: unknown; managerId?: unknown }): Promise<unknown> {
  const project = await managedProject(db, actor, projectId);
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = displayClockifyName(input.name);
  if (input.color !== undefined) data.color = normalizeClockifyColor(input.color);
  if (input.clientId !== undefined) {
    const client = await requireClient(db, String(input.clientId ?? "").trim());
    data.clientId = client.id; data.client = client.name;
  }
  if (input.managerId !== undefined) {
    if (!canAssignClockifyManager(actor.role)) throw new ClockifyCatalogError(403, "Only admins can assign a manager");
    const managerId = String(input.managerId ?? "").trim() || null;
    await validateManager(db, managerId); data.managerId = managerId;
  }
  if (!Object.keys(data).length) throw new ClockifyCatalogError(400, "No project changes supplied");
  const name = String(data.name ?? project.name);
  const client = String(data.client ?? project.client);
  const duplicate = await db.clockifyProject.findFirst({ where: { name, client, NOT: { id: projectId } }, select: { id: true } });
  if (duplicate) throw new ClockifyCatalogError(409, "A project with this client and name already exists");
  try {
    const updated = await db.clockifyProject.update({ where: { id: projectId }, data, select: projectSelect });
    await audit(db, actor.userId, "clockify.project.update", "ClockifyProject", projectId, { fields: Object.keys(data) });
    return updated;
  } catch (error) { rethrowCatalogError(error); }
}

export async function setClockifyProjectArchive(db: Db, actor: ClockifyV2Actor, projectId: string, archived: boolean): Promise<unknown> {
  await managedProject(db, actor, projectId);
  const data = archived ? projectArchivePatch(actor.userId) : projectRestorePatch();
  const action = archived ? "clockify.project.archive" : "clockify.project.restore";
  const [project] = await db.$transaction([
    db.clockifyProject.update({ where: { id: projectId }, data, select: projectSelect }),
    db.auditLog.create({ data: { actorId: actor.userId, actionType: action, entityType: "ClockifyProject", entityId: projectId, metadata: {} } }),
  ]);
  return project;
}

export async function setClockifyProjectManager(db: Db, actor: ClockifyV2Actor, projectId: string, managerId: unknown): Promise<unknown> {
  if (!canAssignClockifyManager(actor.role)) throw new ClockifyCatalogError(403, "Only admins can assign a manager");
  await managedProject(db, actor, projectId);
  const nextManagerId = String(managerId ?? "").trim() || null;
  await validateManager(db, nextManagerId);
  const project = await db.clockifyProject.update({ where: { id: projectId }, data: { managerId: nextManagerId }, select: projectSelect });
  await audit(db, actor.userId, "clockify.project.assignment", "ClockifyProject", projectId, { managerId: nextManagerId });
  return project;
}

export async function listClockifyTasks(db: Db, actor: ClockifyV2Actor, projectId: string): Promise<unknown[]> {
  await managedProject(db, actor, projectId);
  return db.clockifyTask.findMany({ where: { projectId }, orderBy: [{ isActive: "desc" }, { name: "asc" }] });
}

export async function createClockifyTask(db: Db, actor: ClockifyV2Actor, projectId: string, input: { name: unknown }): Promise<unknown> {
  await managedProject(db, actor, projectId);
  const name = displayClockifyName(input.name), normalizedName = normalizeClockifyName(name);
  try {
    const duplicate = await db.clockifyTask.findUnique({ where: { projectId_normalizedName: { projectId, normalizedName } }, select: { id: true } });
    if (duplicate) throw new ClockifyCatalogError(409, "A task with this normalized name already exists");
    const task = await db.clockifyTask.create({ data: { projectId, name, normalizedName, createdById: actor.userId } });
    await audit(db, actor.userId, "clockify.task.create", "ClockifyTask", task.id, { projectId });
    return task;
  } catch (error) { rethrowCatalogError(error); }
}

export async function updateClockifyTask(db: Db, actor: ClockifyV2Actor, projectId: string, taskId: string, input: { name?: unknown; isActive?: unknown }): Promise<unknown> {
  await managedProject(db, actor, projectId);
  const task = await db.clockifyTask.findFirst({ where: { id: taskId, projectId } });
  if (!task) throw new ClockifyCatalogError(404, "Task not found");
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) { const name = displayClockifyName(input.name); data.name = name; data.normalizedName = normalizeClockifyName(name); }
  if (input.isActive !== undefined) data.isActive = Boolean(input.isActive);
  if (!Object.keys(data).length) throw new ClockifyCatalogError(400, "No task changes supplied");
  try {
    const updated = await db.clockifyTask.update({ where: { id: taskId }, data });
    await audit(db, actor.userId, input.isActive === undefined ? "clockify.task.update" : "clockify.task.status", "ClockifyTask", taskId, { projectId, isActive: data.isActive });
    return updated;
  } catch (error) { rethrowCatalogError(error); }
}
