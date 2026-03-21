import test from "node:test";
import assert from "node:assert/strict";

test("dashboard summary route exports GET handler (smoke)", async () => {
  const mod = await import("./route");
  assert.ok(typeof mod.GET === "function");
});
