import test from "node:test";
import assert from "node:assert/strict";

test("absences/[id] route exports handlers (smoke)", async () => {
  const mod = await import("./route");
  assert.ok(typeof mod.PUT === "function");
  assert.ok(typeof mod.DELETE === "function");
});

