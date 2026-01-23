import test from "node:test";
import assert from "node:assert/strict";

test("clockify users route exports handlers (smoke)", async () => {
  const mod = await import("./route");
  assert.ok(typeof mod.GET === "function");
});

