import test from "node:test";
import assert from "node:assert/strict";

test("projects/[id]/members route exports handlers (smoke)", async () => {
  const mod = await import("./route");
  assert.ok(typeof mod.GET === "function");
  assert.ok(typeof mod.POST === "function");
  assert.ok(typeof mod.PATCH === "function");
  assert.ok(typeof mod.DELETE === "function");
});

