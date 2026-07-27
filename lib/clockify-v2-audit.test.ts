import assert from "node:assert/strict";
import test from "node:test";
import { classifyClockifyAuditEntry, isAuditPeriodEffectivelyLocked, normalizeClockifyAuditInput } from "./clockify-v2-audit";

test("Clockify audit gives independent remediation codes and excludes deleted entries", () => {
  const reasons = classifyClockifyAuditEntry({ deletedAt: null, startAt: new Date("2026-07-10T10:00:00Z"), endAt: new Date("2026-07-10T09:00:00Z"), durationMin: 3, overlapCount: 1, projectPresent: false, taskPresent: false, effectivelyLocked: false, expectedLocked: true });
  assert.deepEqual(reasons, ["overlap", "duration_short", "temporal_inconsistency", "missing_project", "missing_task", "active_lock_missing", "unlocked"]);
  assert.deepEqual(classifyClockifyAuditEntry({ deletedAt: new Date(), startAt: new Date(), endAt: new Date(), durationMin: 60, overlapCount: 1, projectPresent: false, taskPresent: false, effectivelyLocked: false, expectedLocked: true }), []);
});

test("audit period lock truth table accepts only matching active period metadata and preserves manual locks", () => {
  const entry = { lockKind: "period", lockPeriodId: "p1", workDate: new Date("2026-07-10T00:00:00Z"), userId: "u1", department: "Sales" };
  const active = { id: "p1", unlockedAt: null, startDate: new Date("2026-07-10T00:00:00Z"), endDate: new Date("2026-07-10T00:00:00Z"), scopeType: "user", targetUserId: "u1", department: null };
  assert.equal(isAuditPeriodEffectivelyLocked(entry, active), true);
  assert.equal(isAuditPeriodEffectivelyLocked(entry, { ...active, unlockedAt: new Date() }), false);
  assert.equal(isAuditPeriodEffectivelyLocked(entry, { ...active, id: "other" }), false);
  assert.equal(isAuditPeriodEffectivelyLocked(entry, { ...active, targetUserId: "other" }), false);
  assert.equal(isAuditPeriodEffectivelyLocked({ ...entry, lockKind: "manual", lockPeriodId: null }, null), true);
});

test("Clockify audit validates a separate anomaly filter and bounded cursor pagination", () => {
  assert.deepEqual(normalizeClockifyAuditInput({ anomaly: "overlap", limit: "20" }), { anomaly: "overlap", limit: 20, cursor: null, filters: null });
  assert.equal(normalizeClockifyAuditInput({ anomaly: "unlocked" }).anomaly, "unlocked");
  assert.throws(() => normalizeClockifyAuditInput({ anomaly: "status", limit: "999" }), /invalid|between/i);
});

test("Clockify audit accepts the same interval and report filters", () => {
  const input = normalizeClockifyAuditInput({
    from: "2026-07-01",
    to: "2026-07-31",
    department: "Grafica",
    userId: "u1",
    client: "Acme",
    projectId: "p1",
    taskId: "t1",
    tag: "urgent",
    locked: "false",
    description: "call",
    billable: "true",
  });
  assert.equal(input.filters?.from, "2026-07-01");
  assert.equal(input.filters?.projectId, "p1");
  assert.equal(input.filters?.locked, false);
});

test("Clockify audit treats an archived historical project as present", () => {
  const reasons = classifyClockifyAuditEntry({
    deletedAt: null,
    startAt: new Date("2026-07-10T09:00:00Z"),
    endAt: new Date("2026-07-10T10:00:00Z"),
    durationMin: 60,
    overlapCount: 0,
    projectPresent: true,
    taskPresent: true,
    effectivelyLocked: true,
    expectedLocked: true,
  });
  assert.deepEqual(reasons, []);
});
