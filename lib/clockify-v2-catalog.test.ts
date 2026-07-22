import assert from "node:assert/strict";
import test from "node:test";
import {
  canAssignClockifyManager,
  canManageCatalogProject,
  createClockifyProjectInput,
  normalizeClockifyName,
  projectArchivePatch,
  projectRestorePatch,
  taskStatusPatch,
} from "./clockify-v2-catalog";
import { createClockifyProject, setClockifyProjectArchive, updateClockifyTask } from "./clockify-v2-catalog-service";

test("Clockify catalog authorization denies members and reserves imported unowned projects for admins", () => {
  const imported = { id: "project", createdById: null, managerId: null, origin: "imported" };
  assert.equal(canManageCatalogProject({ role: "member", userId: "member" }, imported), false);
  assert.equal(canManageCatalogProject({ role: "manager", userId: "manager" }, imported), false);
  assert.equal(canManageCatalogProject({ role: "admin", userId: "admin" }, imported), true);
  assert.equal(canAssignClockifyManager("manager"), false);
  assert.equal(canAssignClockifyManager("admin"), true);
});

test("Clockify catalog normalizes names and dual-writes the legacy client string", () => {
  assert.equal(normalizeClockifyName("  Caffè   Rossi "), "caffè rossi");
  const input = createClockifyProjectInput(
    { role: "manager", userId: "manager" },
    { name: "  Sito   web ", client: { id: "client", name: "  Caffè Rossi " }, color: "#123abc" }
  );
  assert.deepEqual(input, {
    name: "Sito web",
    clientId: "client",
    client: "Caffè Rossi",
    color: "#123ABC",
    origin: "manual",
    createdById: "manager",
    managerId: null,
  });
});

test("Clockify catalog archive and restore patches preserve history and task status is non-destructive", () => {
  const archivedAt = new Date("2026-07-22T10:00:00.000Z");
  assert.deepEqual(projectArchivePatch("admin", archivedAt), {
    isActive: false,
    archivedAt,
    archivedById: "admin",
  });
  assert.deepEqual(projectRestorePatch(), {
    isActive: true,
    archivedAt: null,
    archivedById: null,
  });
  assert.deepEqual(taskStatusPatch(false), { isActive: false });
  assert.deepEqual(taskStatusPatch(true), { isActive: true });
});

test("Clockify catalog rejects normalized duplicate and blank names before persistence", () => {
  assert.throws(() => normalizeClockifyName(" \t "), /Name is required/);
  assert.equal(normalizeClockifyName("A  project"), normalizeClockifyName("a PROJECT"));
});

test("catalog service writes project client relation and legacy client string, archives atomically, and deactivates instead of deleting", async () => {
  const writes: Array<{ kind: string; data: Record<string, unknown> }> = [];
  const project = { id: "p1", name: "Sito", client: "Cliente", clientId: "c1", color: "#6B7280", origin: "manual", isActive: true, createdById: "manager", managerId: null, archivedAt: null, archivedById: null };
  const db = {
    clockifyClient: { findUnique: async () => ({ id: "c1", name: "Cliente" }) },
    clockifyProject: {
      findFirst: async () => null,
      findUnique: async () => project,
      create: async ({ data }: { data: Record<string, unknown> }) => { writes.push({ kind: "project.create", data }); return { ...project, ...data }; },
      update: async ({ data }: { data: Record<string, unknown> }) => { writes.push({ kind: "project.update", data }); return { ...project, ...data }; },
    },
    clockifyTask: {
      findFirst: async () => ({ id: "t1", projectId: "p1", name: "Storico", isActive: true }),
      update: async ({ data }: { data: Record<string, unknown> }) => { writes.push({ kind: "task.update", data }); return { id: "t1", ...data }; },
    },
    auditLog: { create: async ({ data }: { data: Record<string, unknown> }) => { writes.push({ kind: "audit", data }); return data; } },
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
  };
  const actor = { role: "manager" as const, userId: "manager", department: null };
  await createClockifyProject(db, actor, { name: "Sito", clientId: "c1" });
  assert.deepEqual(writes[0], { kind: "project.create", data: { name: "Sito", clientId: "c1", client: "Cliente", color: "#6B7280", origin: "manual", createdById: "manager", managerId: null } });
  await setClockifyProjectArchive(db, actor, "p1", true);
  assert.deepEqual(writes.find((write) => write.kind === "project.update")?.data.isActive, false);
  await updateClockifyTask(db, actor, "p1", "t1", { isActive: false });
  assert.deepEqual(writes.find((write) => write.kind === "task.update")?.data, { isActive: false });
  assert.equal(writes.some((write) => write.kind === "task.delete"), false);
});
