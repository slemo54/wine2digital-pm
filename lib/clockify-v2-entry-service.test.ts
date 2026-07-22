import assert from "node:assert/strict";
import test from "node:test";
import {
  ClockifyEntryError,
  createClockifyEntry,
  deleteClockifyEntry,
  duplicateClockifyEntry,
  listClockifyEntries,
  splitClockifyEntry,
  updateClockifyEntry,
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

test("V2 write lock queries normalize the actor department before matching a period", async () => {
  let where: any;
  const db = { $transaction: async (work: any) => work(db), clockifyProject: { findUnique: async () => ({ id: "p1", isActive: true, archivedAt: null }) }, clockifyLockPeriod: { findFirst: async (value: any) => { where = value.where; return { id: "lock" }; } } };
  await assert.rejects(() => createClockifyEntry(db, { ...actor, department: " grafica " }, input), (error: unknown) => error instanceof ClockifyEntryError && error.status === 409);
  assert.equal(where.OR[1].department, "Grafica");
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
  const result: any = await splitClockifyEntry(db, actor, "e1", { splitDate: "2026-07-22", splitTime: "09:30" });
  assert.equal(result.original.durationMin + result.second.durationMin, 60);
  assert.equal(updates[0].data.durationMin, 30);
  assert.equal(creates[0].data.durationMin, 30);
  assert.equal(audits.length, 2);
  await assert.rejects(() => splitClockifyEntry(db, actor, "e1", { splitDate: "2026-07-22", splitTime: "09:00" }), /strictly inside/);
});

test("V2 list always filters soft-deleted entries and bounds the report period", async () => {
  let where: any;
  const db = { clockifyEntry: { findMany: async (value: any) => { where = value.where; return []; } } };
  await listClockifyEntries(db, actor, { from: "2026-07-01", to: "2026-07-02" });
  assert.equal(where.deletedAt, null);
  assert.equal(where.userId, "u1");
  await assert.rejects(() => listClockifyEntries(db, actor, { from: "2026-01-01", to: "2026-06-01" }), /93 days/);
});

test("V2 list uses a stable startAt/id cursor, bounded pages, and full-period totals", async () => {
  const first = { ...source, id: "e1", durationMin: 60, startAt: new Date("2026-07-22T07:00:00.000Z") };
  const second = { ...source, id: "e2", durationMin: 30, startAt: new Date("2026-07-22T08:00:00.000Z") };
  const calls: any[] = [];
  const db = {
    clockifyEntry: {
      findMany: async (value: any) => { calls.push(value); return [first, second]; },
      aggregate: async () => ({ _sum: { durationMin: 90 }, _count: { id: 2 } }),
    },
  };
  const result: any = await listClockifyEntries(db, actor, { from: "2026-07-22", to: "2026-07-22", limit: "1" });
  assert.equal(calls[0].take, 2);
  assert.equal(result.page.limit, 1);
  assert.equal(result.groups.period.totalMin, 90);
  assert.ok(result.nextCursor);
  const decoded = JSON.parse(Buffer.from(result.nextCursor, "base64url").toString("utf8"));
  assert.deepEqual(decoded, { startAt: first.startAt.toISOString(), id: "e1" });
  void second;
});

test("V2 update and duplicate reject manually or period-locked own entries through the mutation protocol", async () => {
  const manual = { ...source, lockedAt: new Date() };
  const manuallyLocked = { $transaction: async (work: any) => work(manuallyLocked), clockifyEntry: { findFirst: async () => manual } };
  await assert.rejects(() => updateClockifyEntry(manuallyLocked, actor, "e1", input), (error: unknown) => error instanceof ClockifyEntryError && error.status === 409);
  const periodLocked = { $transaction: async (work: any) => work(periodLocked), clockifyEntry: { findFirst: async () => source }, clockifyLockPeriod: { findFirst: async () => ({ id: "lock" }) } };
  await assert.rejects(() => duplicateClockifyEntry(periodLocked, actor, "e1", { date: "2026-07-23", startTime: "09:00", durationMin: 60 }), (error: unknown) => error instanceof ClockifyEntryError && error.status === 409);
});

test("V2 list scopes managers to the normalized department and returns effective period locks", async () => {
  let entryWhere: any; let lockWhere: any;
  const db = {
    clockifyEntry: { findMany: async (value: any) => { entryWhere = value.where; return [{ ...source, user: { id: "u1", name: "User", email: "u1@test", department: "Grafica" } }]; } },
    clockifyLockPeriod: { findFirst: async (value: any) => { lockWhere = value.where; return { id: "p-lock" }; } },
  };
  const result: any = await listClockifyEntries(db, { ...actor, role: "manager", department: " grafica " }, { from: "2026-07-22", to: "2026-07-22" });
  assert.equal(entryWhere.user.department.equals, "Grafica");
  assert.equal(lockWhere.OR[1].department.equals, "Grafica");
  assert.equal(result.entries[0].effectiveLocked, true);
  assert.equal(result.entries[0].effectiveLockKind, "period");
});

test("V2 mutation rollback leaves no soft-delete write when the audited transaction fails", async () => {
  const writes: any[] = [];
  const db = {
    $transaction: async (work: any) => { const snapshot = writes.length; try { return await work(db); } catch (error) { writes.splice(snapshot); throw error; } },
    clockifyEntry: { findFirst: async () => source, update: async (value: any) => { writes.push(value); return source; } },
    clockifyLockPeriod: { findFirst: async () => null },
    auditLog: { create: async () => { throw new Error("audit failure"); } },
  };
  await assert.rejects(() => deleteClockifyEntry(db, actor, "e1"), /audit failure/);
  assert.equal(writes.length, 0);
});

test("V2 members, managers, and admins all receive the same own-entry-only mutation boundary", async () => {
  for (const role of ["member", "manager", "admin"] as const) {
    const db = { $transaction: async (work: any) => work(db), clockifyEntry: { findFirst: async () => null } };
    await assert.rejects(() => updateClockifyEntry(db, { ...actor, role }, "other-user-entry", input), (error: unknown) => error instanceof ClockifyEntryError && error.status === 404);
  }
});

test("V2 split rejects legacy source timestamps that are not exact-minute boundaries", async () => {
  const imprecise = { ...source, startAt: new Date("2026-07-22T07:00:30.000Z"), durationMin: 59 };
  const db = { $transaction: async (work: any) => work(db), clockifyEntry: { findFirst: async () => imprecise }, clockifyLockPeriod: { findFirst: async () => null } };
  await assert.rejects(() => splitClockifyEntry(db, actor, "e1", { splitDate: "2026-07-22", splitTime: "09:30" }), /exact minute precision/);
});
