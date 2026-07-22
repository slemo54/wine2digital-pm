import assert from "node:assert/strict";
import test from "node:test";
import { ClockifyLockError, createClockifyLockPeriod, lockClockifyEntry, unlockClockifyLockPeriod } from "./clockify-v2-locks";

const admin = { userId: "admin", role: "admin" as const, department: null };
const member = { userId: "u1", role: "member" as const, department: " Grafica " };

test("period unlock clears only metadata created by that period and preserves manual locks", async () => {
  const updates: any[] = [];
  const period = { id: "period-1", startDate: new Date("2026-07-20T22:00:00.000Z"), endDate: new Date("2026-07-22T22:00:00.000Z"), scopeType: "all", department: null, targetUserId: null, unlockedAt: null };
  const db = { $transaction: async (work: any) => work(db), clockifyLockPeriod: { findUnique: async () => period, update: async (value: any) => value.data }, clockifyEntry: { updateMany: async (value: any) => { updates.push(value); return { count: 1 }; } }, auditLog: { create: async () => undefined } };
  await unlockClockifyLockPeriod(db, admin, "period-1");
  assert.deepEqual(updates[0].where, { lockKind: "period", lockPeriodId: "period-1" });
  assert.deepEqual(updates[0].data, { lockedAt: null, lockedById: null, lockKind: null, lockPeriodId: null });
});

test("period creation canonicalizes department, applies matching rows, and audits atomically", async () => {
  const creates: any[] = []; const entryUpdates: any[] = []; const audits: any[] = [];
  const db = { $transaction: async (work: any) => work(db), user: { findMany: async () => [{ id: "u1", department: "Grafica" }, { id: "u2", department: "Vendite" }] }, clockifyLockPeriod: { create: async (value: any) => { creates.push(value); return { id: "period-1", ...value.data }; } }, clockifyEntry: { updateMany: async (value: any) => { entryUpdates.push(value); return { count: 2 }; } }, auditLog: { create: async (value: any) => { audits.push(value); } } };
  await createClockifyLockPeriod(db, admin, { startDate: "2026-07-21", endDate: "2026-07-22", scopeType: "department", department: " grafica " });
  assert.equal(creates[0].data.department, "Grafica");
  assert.deepEqual(entryUpdates[0].where.userId, { in: ["u1"] });
  assert.equal(entryUpdates[0].data.lockKind, "period");
  assert.equal(audits[0].data.actionType, "clockify.lock-period.create");
});

test("lock writers reject non-admins and malformed scope/date combinations", async () => {
  const db = { $transaction: async (work: any) => work(db) };
  await assert.rejects(() => createClockifyLockPeriod(db, member, { startDate: "2026-07-23", endDate: "2026-07-22", scopeType: "all" }), (error: unknown) => error instanceof ClockifyLockError && error.status === 403);
  await assert.rejects(() => createClockifyLockPeriod(db, admin, { startDate: "2026-07-23", endDate: "2026-07-22", scopeType: "all" }), (error: unknown) => error instanceof ClockifyLockError && error.status === 400);
  await assert.rejects(() => createClockifyLockPeriod(db, admin, { startDate: "2026-07-22", endDate: "2026-07-22", scopeType: "user" }), (error: unknown) => error instanceof ClockifyLockError && error.status === 400);
});

test("manual lock uses the shared transaction protocol and records distinguishable provenance", async () => {
  const updates: any[] = []; const audits: any[] = []; const protocol: any[] = [];
  const db = { $transaction: async (work: any, options: any) => { protocol.push(options); return work(db); }, $queryRawUnsafe: async () => undefined, clockifyEntry: { findUnique: async () => ({ id: "e1", deletedAt: null }), update: async (value: any) => { updates.push(value); return { id: "e1", ...value.data }; } }, auditLog: { create: async (value: any) => { audits.push(value); } } };
  await lockClockifyEntry(db, admin, "e1");
  assert.equal(protocol[0].isolationLevel, "Serializable");
  assert.equal(updates[0].data.lockKind, "manual");
  assert.equal(audits[0].data.actionType, "clockify.entry.lock");
});
