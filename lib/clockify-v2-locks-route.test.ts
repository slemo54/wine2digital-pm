import assert from "node:assert/strict";
import test from "node:test";
import { clockifyV2Error } from "./clockify-v2-api";
import { ClockifyLockError } from "./clockify-v2-locks";
import { createClockifyEntryLockRouteHandlers, createClockifyLockPeriodsRouteHandlers } from "./clockify-v2-locks-route";

const admin = { userId: "a1", role: "admin" as const, department: null };

test("lock routes retain disabled/unauthenticated responses and deny managers", async () => {
  const disabled = createClockifyEntryLockRouteHandlers({ getActor: async () => ({ actor: null, response: clockifyV2Error(404, "Not found") }) });
  assert.equal((await disabled.POST(new Request("http://test"), "e1")).status, 404);
  const manager = createClockifyLockPeriodsRouteHandlers({ getActor: async () => ({ actor: { ...admin, role: "manager" as const } }) });
  assert.equal((await manager.POST(new Request("http://test", { method: "POST", body: "{}" }))).status, 403);
});

test("lock routes map malformed data and successful manual/period actions", async () => {
  const entry = createClockifyEntryLockRouteHandlers({ getActor: async () => ({ actor: admin }), lock: async () => ({ id: "e1" }), unlock: async () => { throw new ClockifyLockError(409, "period lock"); } });
  assert.equal((await entry.POST(new Request("http://test"), "e1")).status, 200);
  assert.equal((await entry.DELETE(new Request("http://test"), "e1")).status, 409);
  const periods = createClockifyLockPeriodsRouteHandlers({ getActor: async () => ({ actor: admin }), list: async () => [{ id: "p1" }], create: async () => { throw new ClockifyLockError(400, "invalid scope"); } });
  assert.equal((await periods.GET(new Request("http://test"))).status, 200);
  assert.equal((await periods.POST(new Request("http://test", { method: "POST", body: "{}" }))).status, 400);
});
