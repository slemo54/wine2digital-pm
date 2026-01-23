import test from "node:test";
import assert from "node:assert/strict";

test("projects route is reachable (smoke)", async () => {
  const mod = await import("./route");
  assert.ok(typeof mod.GET === "function");
  assert.ok(typeof mod.POST === "function");
  assert.ok(typeof mod.PATCH === "function");
});

