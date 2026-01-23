import test from "node:test";
import assert from "node:assert/strict";

test("subtask checklist items route is reachable (smoke)", async () => {
  const mod = await import("./route");
  assert.ok(typeof mod.POST === "function");
});


