import test from "node:test";
import assert from "node:assert/strict";
import { buildAbsenceVisibilityWhere, canDecideAbsence } from "./absence-permissions";

test("buildAbsenceVisibilityWhere - Admin", () => {
  const where = buildAbsenceVisibilityWhere({ role: "admin", userId: "u1", department: "IT" });
  assert.deepEqual(where, {});
});

test("buildAbsenceVisibilityWhere - Manager with department", () => {
  const where = buildAbsenceVisibilityWhere({ role: "manager", userId: "u1", department: "IT" });
  assert.deepEqual(where, {
    OR: [
      { userId: "u1" },
      { user: { department: "IT" } }
    ]
  });
});

test("buildAbsenceVisibilityWhere - Manager without department", () => {
  const where = buildAbsenceVisibilityWhere({ role: "manager", userId: "u1", department: null });
  assert.deepEqual(where, { userId: "u1" });
});

test("buildAbsenceVisibilityWhere - Member", () => {
  const where = buildAbsenceVisibilityWhere({ role: "member", userId: "u1", department: "IT" });
  assert.deepEqual(where, { userId: "u1" });
});

test("canDecideAbsence - Admin", () => {
  const allowed = canDecideAbsence({ actorRole: "admin" });
  assert.strictEqual(allowed, true);
});

test("canDecideAbsence - Manager same department", () => {
  const allowed = canDecideAbsence({ actorRole: "manager", actorDepartment: "IT", targetDepartment: "IT" });
  assert.strictEqual(allowed, true);
});

test("canDecideAbsence - Manager different department", () => {
  const allowed = canDecideAbsence({ actorRole: "manager", actorDepartment: "IT", targetDepartment: "Sales" });
  assert.strictEqual(allowed, false);
});

test("canDecideAbsence - Manager no department", () => {
  const allowed = canDecideAbsence({ actorRole: "manager", actorDepartment: null, targetDepartment: "IT" });
  assert.strictEqual(allowed, false);
});

test("canDecideAbsence - Member", () => {
  const allowed = canDecideAbsence({ actorRole: "member", actorDepartment: "IT", targetDepartment: "IT" });
  assert.strictEqual(allowed, false);
});
