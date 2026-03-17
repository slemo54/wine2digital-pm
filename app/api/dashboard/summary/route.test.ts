import test from "node:test";
import assert from "node:assert/strict";

test("dashboard summary route exports GET handler", async () => {
  const mod = await import("./route.ts");
  assert.ok(typeof mod.GET === "function");
});
