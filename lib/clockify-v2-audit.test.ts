import assert from "node:assert/strict";
import test from "node:test";
import { classifyClockifyAuditEntry, isAuditPeriodEffectivelyLocked, normalizeClockifyAuditInput } from "./clockify-v2-audit";

test("Clockify audit gives independent remediation codes and excludes deleted entries", () => {
  const reasons = classifyClockifyAuditEntry({ deletedAt: null, startAt: new Date("2026-07-10T10:00:00Z"), endAt: new Date("2026-07-10T09:00:00Z"), durationMin: 3, overlapCount: 1, projectPresent: false, taskPresent: false, effectivelyLocked: false, expectedLocked: true });
  assert.deepEqual(reasons, ["overlap", "duration_short", "temporal_inconsistency", "missing_project", "missing_task", "active_lock_missing"]);
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
  assert.deepEqual(normalizeClockifyAuditInput({ anomaly: "overlap", limit: "20" }), { anomaly: "overlap", limit: 20, cursor: null });
  assert.throws(() => normalizeClockifyAuditInput({ anomaly: "status", limit: "999" }), /invalid|between/i);
});
