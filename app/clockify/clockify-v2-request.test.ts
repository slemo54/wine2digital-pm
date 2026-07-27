import assert from "node:assert/strict";
import test from "node:test";

test("request gate rejects responses from superseded Clockify loads", async () => {
  const requestHelpers: any = await import("./clockify-v2-request");
  assert.equal(typeof requestHelpers.createClockifyRequestGate, "function");
  const gate = requestHelpers.createClockifyRequestGate();
  const first = gate.begin();
  const second = gate.begin();
  assert.equal(gate.isCurrent(first), false);
  assert.equal(gate.isCurrent(second), true);
});
