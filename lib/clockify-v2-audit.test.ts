import assert from "node:assert/strict";
import test from "node:test";
import { classifyClockifyAuditEntry, normalizeClockifyAuditInput } from "./clockify-v2-audit";

test("Clockify audit gives independent remediation codes and excludes deleted entries", () => {
  const reasons = classifyClockifyAuditEntry({ deletedAt: null, startAt: new Date("2026-07-10T10:00:00Z"), endAt: new Date("2026-07-10T09:00:00Z"), durationMin: 3, overlapCount: 1, projectPresent: false, taskPresent: false, effectivelyLocked: false, expectedLocked: true });
  assert.deepEqual(reasons, ["overlap", "duration_short", "temporal_inconsistency", "missing_project", "missing_task", "active_lock_missing"]);
  assert.deepEqual(classifyClockifyAuditEntry({ deletedAt: new Date(), startAt: new Date(), endAt: new Date(), durationMin: 60, overlapCount: 1, projectPresent: false, taskPresent: false, effectivelyLocked: false, expectedLocked: true }), []);
});

test("Clockify audit validates a separate anomaly filter and bounded cursor pagination", () => {
  assert.deepEqual(normalizeClockifyAuditInput({ anomaly: "overlap", limit: "20" }), { anomaly: "overlap", limit: 20, cursor: null });
  assert.throws(() => normalizeClockifyAuditInput({ anomaly: "status", limit: "999" }), /invalid|between/i);
});
