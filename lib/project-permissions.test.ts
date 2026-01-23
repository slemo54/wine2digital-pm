import test from "node:test";
import assert from "node:assert/strict";
import { canManageProjectMembers, normalizeProjectMemberRole } from "./project-permissions";

test("normalizeProjectMemberRole", () => {
  assert.equal(normalizeProjectMemberRole("owner"), "owner");
  assert.equal(normalizeProjectMemberRole("manager"), "manager");
  assert.equal(normalizeProjectMemberRole("member"), "member");
  assert.equal(normalizeProjectMemberRole("x"), "member");
  assert.equal(normalizeProjectMemberRole(null), "member");
  assert.equal(normalizeProjectMemberRole(undefined), "member");
});

test("canManageProjectMembers - global admin", () => {
  assert.equal(canManageProjectMembers({ globalRole: "admin", projectRole: "member" }), true);
});

test("canManageProjectMembers - project roles", () => {
  assert.equal(canManageProjectMembers({ globalRole: "member", projectRole: "owner" }), true);
  assert.equal(canManageProjectMembers({ globalRole: "member", projectRole: "manager" }), true);
  assert.equal(canManageProjectMembers({ globalRole: "member", projectRole: "member" }), false);
});


