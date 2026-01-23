import test from "node:test";
import assert from "node:assert/strict";

test("subtasks/dependencies/[id] route exports handlers (smoke)", async () => {
  const mod = await import("./route");
  assert.ok(typeof mod.DELETE === "function");
});

