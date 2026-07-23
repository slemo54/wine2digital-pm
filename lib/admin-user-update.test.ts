import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAdminUserAuditChanges,
  parseAdminUserUpdate,
  wouldDisableLastActiveAdmin,
} from "./admin-user-update";

test("parseAdminUserUpdate accepts the isActive API field", () => {
  assert.deepEqual(parseAdminUserUpdate({ isActive: false }), {
    ok: true,
    value: { isActive: false },
  });
});

test("parseAdminUserUpdate rejects the obsolete active field", () => {
  assert.deepEqual(parseAdminUserUpdate({ active: false }), {
    ok: false,
    error: "Unsupported fields: active",
  });
});

test("parseAdminUserUpdate rejects an empty update", () => {
  assert.deepEqual(parseAdminUserUpdate({}), {
    ok: false,
    error: "No supported fields supplied",
  });
});

test("wouldDisableLastActiveAdmin blocks deactivation and demotion", () => {
  const target = { role: "admin", isActive: true };

  assert.equal(
    wouldDisableLastActiveAdmin({ target, patch: { isActive: false }, activeAdminCount: 1 }),
    true,
  );
  assert.equal(
    wouldDisableLastActiveAdmin({ target, patch: { role: "member" }, activeAdminCount: 1 }),
    true,
  );
  assert.equal(
    wouldDisableLastActiveAdmin({ target, patch: { isActive: false }, activeAdminCount: 2 }),
    false,
  );
});

test("buildAdminUserAuditChanges records the real activation transition", () => {
  assert.deepEqual(
    buildAdminUserAuditChanges(
      { role: "member", isActive: true, department: "IT", calendarEnabled: true },
      { role: "member", isActive: false, department: "IT", calendarEnabled: true },
    ),
    { isActive: { old: true, new: false } },
  );
});
