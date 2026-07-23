import assert from "node:assert/strict";
import test from "node:test";
import { isClockifyV2Enabled } from "./feature-flags";
import {
  canAccessClockifyAdmin,
  canManageClockifyLocks,
  canManageClockifyProject,
  canMutateClockifyEntry,
  getClockifyReportScope,
} from "./clockify-v2-permissions";

test("Clockify V2 flag is enabled only by the literal true value", () => {
  const previous = process.env.NEXT_PUBLIC_CLOCKIFY_V2_ENABLED;

  try {
    process.env.NEXT_PUBLIC_CLOCKIFY_V2_ENABLED = "true";
    assert.equal(isClockifyV2Enabled(), true);

    process.env.NEXT_PUBLIC_CLOCKIFY_V2_ENABLED = "TRUE";
    assert.equal(isClockifyV2Enabled(), false);

    delete process.env.NEXT_PUBLIC_CLOCKIFY_V2_ENABLED;
    assert.equal(isClockifyV2Enabled(), false);
  } finally {
    if (previous === undefined) {
      delete process.env.NEXT_PUBLIC_CLOCKIFY_V2_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_CLOCKIFY_V2_ENABLED = previous;
    }
  }
});

test("Clockify V2 admin access is limited to admins and managers", () => {
  assert.equal(canAccessClockifyAdmin("admin"), true);
  assert.equal(canAccessClockifyAdmin("manager"), true);
  assert.equal(canAccessClockifyAdmin("member"), false);
});

test("Clockify V2 project management respects ownership and assigned manager", () => {
  assert.equal(
    canManageClockifyProject({ role: "admin", userId: "u1", createdById: null, managerId: null }),
    true
  );
  assert.equal(
    canManageClockifyProject({ role: "manager", userId: "u1", createdById: "u1", managerId: null }),
    true
  );
  assert.equal(
    canManageClockifyProject({ role: "manager", userId: "u1", createdById: "u2", managerId: "u1" }),
    true
  );
  assert.equal(
    canManageClockifyProject({ role: "manager", userId: "u1", createdById: "u2", managerId: "u3" }),
    false
  );
  assert.equal(
    canManageClockifyProject({ role: "member", userId: "u1", createdById: "u1", managerId: "u1" }),
    false
  );
});

test("Clockify V2 entry mutation is restricted to an actor's unlocked, non-deleted entries", () => {
  assert.equal(
    canMutateClockifyEntry({ actorId: "u1", entryUserId: "u1", isLocked: false, isDeleted: false }),
    true
  );
  assert.equal(
    canMutateClockifyEntry({ actorId: "u1", entryUserId: "u2", isLocked: false, isDeleted: false }),
    false
  );
  assert.equal(
    canMutateClockifyEntry({ actorId: "u1", entryUserId: "u1", isLocked: true, isDeleted: false }),
    false
  );
  assert.equal(
    canMutateClockifyEntry({ actorId: "u1", entryUserId: "u1", isLocked: false, isDeleted: true }),
    false
  );
});

test("Clockify V2 lock management is admin-only", () => {
  assert.equal(canManageClockifyLocks("admin"), true);
  assert.equal(canManageClockifyLocks("manager"), false);
  assert.equal(canManageClockifyLocks("member"), false);
});

test("Clockify V2 report scope keeps configured department normalization outside the helper", () => {
  assert.deepEqual(getClockifyReportScope({ role: "admin", userId: "u1", department: "Grafica" }), {
    kind: "all",
  });
  assert.deepEqual(getClockifyReportScope({ role: "manager", userId: "u1", department: " Grafica " }), {
    kind: "department",
    department: " Grafica ",
  });
  assert.deepEqual(getClockifyReportScope({ role: "manager", userId: "u1", department: "   " }), {
    kind: "self",
    userId: "u1",
  });
  assert.deepEqual(getClockifyReportScope({ role: "member", userId: "u1", department: "Grafica" }), {
    kind: "self",
    userId: "u1",
  });
});
