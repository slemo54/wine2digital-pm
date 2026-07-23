import test from "node:test";
import assert from "node:assert/strict";
import { MEMBER_TASK_EDITABLE_KEYS, canMemberEditSubtaskDetails, validateMemberTaskUpdateKeys } from "./task-update-policy";
import * as taskUpdatePolicy from "./task-update-policy";

test("validateMemberTaskUpdateKeys: allows empty/non-object bodies", () => {
  assert.deepEqual(validateMemberTaskUpdateKeys(undefined), { ok: true });
  assert.deepEqual(validateMemberTaskUpdateKeys(null), { ok: true });
  assert.deepEqual(validateMemberTaskUpdateKeys("x"), { ok: true });
  assert.deepEqual(validateMemberTaskUpdateKeys(123), { ok: true });
});

test("validateMemberTaskUpdateKeys: allows only editable keys", () => {
  const okBody = { title: "T", description: "D", status: "todo", priority: "high", dueDate: "2026-01-14" };
  assert.deepEqual(validateMemberTaskUpdateKeys(okBody), { ok: true });
});

test("validateMemberTaskUpdateKeys: rejects unknown keys", () => {
  const res = validateMemberTaskUpdateKeys({ assigneeIds: ["x"], status: "todo" });
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.deepEqual(res.invalidKeys, ["assigneeIds"]);
  }
});

test("canMemberEditSubtaskDetails: task assignee OR subtask assignee", () => {
  assert.equal(canMemberEditSubtaskDetails({ isTaskAssignee: true, isSubtaskAssignee: false }), true);
  assert.equal(canMemberEditSubtaskDetails({ isTaskAssignee: false, isSubtaskAssignee: true }), true);
  assert.equal(canMemberEditSubtaskDetails({ isTaskAssignee: false, isSubtaskAssignee: false }), false);
});

test("MEMBER_TASK_EDITABLE_KEYS are stable", () => {
  assert.deepEqual(MEMBER_TASK_EDITABLE_KEYS, ["title", "description", "status", "priority", "dueDate"]);
});

test("normalizeTaskDescriptionUpdate trims text and converts blank values to null", () => {
  const normalizeTaskDescriptionUpdate = (taskUpdatePolicy as any).normalizeTaskDescriptionUpdate;

  assert.equal(typeof normalizeTaskDescriptionUpdate, "function");
  assert.deepEqual(normalizeTaskDescriptionUpdate(undefined), { ok: true, value: undefined });
  assert.deepEqual(normalizeTaskDescriptionUpdate(null), { ok: true, value: null });
  assert.deepEqual(normalizeTaskDescriptionUpdate("  Biglietto Lufthansa Canada Giugno  "), {
    ok: true,
    value: "Biglietto Lufthansa Canada Giugno",
  });
  assert.deepEqual(normalizeTaskDescriptionUpdate("   "), { ok: true, value: null });
});

test("normalizeTaskDescriptionUpdate rejects non-string values", () => {
  const normalizeTaskDescriptionUpdate = (taskUpdatePolicy as any).normalizeTaskDescriptionUpdate;

  assert.equal(typeof normalizeTaskDescriptionUpdate, "function");
  assert.deepEqual(normalizeTaskDescriptionUpdate(42), {
    ok: false,
    error: "description must be a string or null",
  });
  assert.deepEqual(normalizeTaskDescriptionUpdate({ text: "invalid" }), {
    ok: false,
    error: "description must be a string or null",
  });
});
