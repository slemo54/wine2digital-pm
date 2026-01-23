import test from "node:test";
import assert from "node:assert/strict";

test("parse types: search route is reachable (smoke)", async () => {
  // Lightweight smoke: ensure module can be imported.
  const mod = await import("./route");
  assert.ok(typeof mod.GET === "function");
});




