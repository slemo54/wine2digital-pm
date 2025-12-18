import test from "node:test";
import assert from "node:assert/strict";

test("subtask comment detail route is reachable (smoke)", async () => {
  const mod = await import("./route");
  assert.ok(typeof mod.PUT === "function");
  assert.ok(typeof mod.DELETE === "function");
});

