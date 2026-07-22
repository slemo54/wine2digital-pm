import assert from "node:assert/strict";
import test from "node:test";
import {
  ClockifyEntryError,
  createClockifyEntry,
  deleteClockifyEntry,
  listClockifyEntries,
  splitClockifyEntry,
} from "./clockify-v2-entries";

const actor = { userId: "u1", role: "member" as const, department: "Grafica" };
const input = { projectId: "p1", description: "Analisi", tags: [], billable: false, date: "2026-07-22", startTime: "09:00", durationMin: 60 };
const source = { id: "e1", userId: "u1", projectId: "p1", taskId: null, task: null, description: "Analisi", tags: ["work"], billable: true, workDate: new Date("2026-07-21T22:00:00.000Z"), startAt: new Date("2026-07-22T07:00:00.000Z"), endAt: new Date("2026-07-22T08:00:00.000Z"), durationMin: 60, lockedAt: null, lockKind: null, deletedAt: null };

test("V2 create rejects inactive projects, invalid tasks, and locks on a future work date", async () => {
  const inactive = { $transaction: async (work: any) => work(inactive), clockifyProject: { findUnique: async () => ({ id: "p1", isActive: false, archivedAt: null }) } };
  await assert.rejects(() => createClockifyEntry(inactive, actor, input), (error: unknown) => error instanceof ClockifyEntryError && error.status === 400);
  const locked = { $transaction: async (work: any) => work(locked), clockifyProject: { findUnique: async () => ({ id: "p1", isActive: true, archivedAt: null }) }, clockifyLockPeriod: { findFirst: async () => ({ id: "future-lock" }) } };
  await assert.rejects(() => createClockifyEntry(locked, actor, input), (error: unknown) => error instanceof ClockifyEntryError && error.status === 409);
  const taskMismatch = { $transaction: async (work: any) => work(taskMismatch), clockifyProject: { findUnique: async () => ({ id: "p1", isActive: true, archivedAt: null }) }, clockifyTask: { findFirst: async () => null }, clockifyLockPeriod: { findFirst: async () => null } };
  await assert.rejects(() => createClockifyEntry(taskMismatch, actor, { ...input, taskId: "wrong" }), /Task must be active/);
});

test("V2 delete finds only an own non-deleted entry and performs a soft delete plus audit", async () => {
  const updates: any[] = [], audits: any[] = [];
  const db = { $transaction: async (work: any) => work(db), clockifyEntry: { findFirst: async () => source, update: async (value: any) => { updates.push(value); return source; } }, clockifyLockPeriod: { findFirst: async () => null }, auditLog: { create: async (value: any) => { audits.push(value); } } };
  await deleteClockifyEntry(db, actor, "e1");
  assert.equal(updates[0].data.deletedById, "u1");
  assert.ok(updates[0].data.deletedAt instanceof Date);
  assert.equal(audits[0].data.actionType, "clockify.entry.delete");
  const absent = { $transaction: async (work: any) => work(absent), clockifyEntry: { findFirst: async () => null } };
  await assert.rejects(() => deleteClockifyEntry(absent, actor, "someone-else"), (error: unknown) => error instanceof ClockifyEntryError && error.status === 404);
});

test("V2 split is transactional, strictly internal, and conserves duration with two linked audit records", async () => {
  const updates: any[] = [], creates: any[] = [], audits: any[] = [];
  const db = { $transaction: async (work: any) => work(db), clockifyEntry: { findFirst: async () => source, update: async (value: any) => { updates.push(value); return { ...source, ...value.data }; }, create: async (value: any) => { creates.push(value); return { id: "e2", ...value.data }; } }, clockifyLockPeriod: { findFirst: async () => null }, auditLog: { create: async (value: any) => { audits.push(value); } } };
  const result: any = await splitClockifyEntry(db, actor, "e1", "2026-07-22T07:30:00.000Z");
  assert.equal(result.original.durationMin + result.second.durationMin, 60);
  assert.equal(updates[0].data.durationMin, 30);
  assert.equal(creates[0].data.durationMin, 30);
  assert.equal(audits.length, 2);
  await assert.rejects(() => splitClockifyEntry(db, actor, "e1", "2026-07-22T07:00:00.000Z"), /strictly inside/);
});

test("V2 list always filters soft-deleted entries and bounds the report period", async () => {
  let where: any;
  const db = { clockifyEntry: { findMany: async (value: any) => { where = value.where; return []; } } };
  await listClockifyEntries(db, actor, { from: "2026-07-01", to: "2026-07-02" });
  assert.equal(where.deletedAt, null);
  assert.equal(where.userId, "u1");
  await assert.rejects(() => listClockifyEntries(db, actor, { from: "2026-01-01", to: "2026-06-01" }), /93 days/);
});
