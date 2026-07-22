import assert from "node:assert/strict";
import test from "node:test";
import { clockifyV2Error } from "@/lib/clockify-v2-api";
import { ClockifyEntryError } from "@/lib/clockify-v2-entries";
import { createClockifyEntriesRouteHandlers } from "@/lib/clockify-v2-entries-route";

const actor = { userId: "u1", role: "member" as const, department: "Grafica" };

test("V2 entries route preserves feature/auth response statuses", async () => {
  const disabled = createClockifyEntriesRouteHandlers({ getActor: async () => ({ actor: null, response: clockifyV2Error(404, "Not found") }) });
  assert.equal((await disabled.GET(new Request("http://test/api/clockify/v2/entries?from=2026-07-01&to=2026-07-02"))).status, 404);
  const anonymous = createClockifyEntriesRouteHandlers({ getActor: async () => ({ actor: null, response: clockifyV2Error(401, "Unauthorized") }) });
  assert.equal((await anonymous.POST(new Request("http://test", { method: "POST", body: "{}" }))).status, 401);
});

test("V2 entries route maps validation and lock failures to 400 and 409", async () => {
  const handler = createClockifyEntriesRouteHandlers({
    getActor: async () => ({ actor }),
    create: async () => { throw new ClockifyEntryError(400, "date must be YYYY-MM-DD"); },
    list: async () => { throw new ClockifyEntryError(409, "This reporting period is locked"); },
  });
  const invalid = await handler.POST(new Request("http://test", { method: "POST", body: "{}" }));
  assert.equal(invalid.status, 400);
  const locked = await handler.GET(new Request("http://test/api/clockify/v2/entries?from=2026-07-01&to=2026-07-02"));
  assert.equal(locked.status, 409);
});
