import test from "node:test";
import assert from "node:assert/strict";
import { canReadWiki, canWriteWiki } from "@/lib/wiki-permissions";

test("wiki permissions: admin can read/write", () => {
  assert.equal(canReadWiki({ globalRole: "admin", isProjectMember: false }), true);
  assert.equal(canWriteWiki({ globalRole: "admin", projectRole: null }), true);
});

test("wiki permissions: project member can read/write in MVP", () => {
  assert.equal(canReadWiki({ globalRole: "member", isProjectMember: true }), true);
  assert.equal(canWriteWiki({ globalRole: "member", projectRole: "member" }), true);
});




