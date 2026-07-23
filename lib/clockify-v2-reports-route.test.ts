import assert from "node:assert/strict";
import test from "node:test";
import { clockifyV2Error } from "./clockify-v2-api";
import { ClockifyReportError } from "./clockify-v2-reports";
import { createClockifyReportRouteHandlers, createClockifyReportShareRouteHandlers, publicClockifyReportShareRoute } from "./clockify-v2-reports-route";

const actor = { userId: "u1", role: "member" as const, department: null };

test("report routes preserve disabled/auth/validation statuses", async () => {
  const disabled = createClockifyReportRouteHandlers({ getActor: async () => ({ actor: null, response: clockifyV2Error(404, "Not found") }) });
  assert.equal((await disabled.GET(new Request("http://test?from=2026-07-01&to=2026-07-02"))).status, 404);
  const invalid = createClockifyReportRouteHandlers({ getActor: async () => ({ actor }), run: async () => { throw new ClockifyReportError(400, "bad"); } });
  assert.equal((await invalid.GET(new Request("http://test?from=2026-07-01&to=2026-07-02"))).status, 400);
});

test("report CSV uses the same engine and responds as downloadable text", async () => {
  const route = createClockifyReportRouteHandlers({ getActor: async () => ({ actor }), run: async () => ({ type: "summary", totalMin: 1, timeSeries: [], bar: [] }), exportCsv: () => new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("Date,Minutes\r\n")); controller.close(); } }) });
  const response = await route.CSV(new Request("http://test?from=2026-07-01&to=2026-07-02"));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /text\/csv/);
});

test("share routes return a raw token only at creation and owner-only revocation", async () => {
  const route = createClockifyReportShareRouteHandlers({ getActor: async () => ({ actor }), create: async () => ({ id: "s1", token: "a".repeat(43), reportType: "summary" as const, createdAt: new Date() }), list: async () => [], revoke: async () => undefined });
  const created = await route.POST(new Request("http://test", { method: "POST", body: JSON.stringify({ reportType: "summary", from: "2026-07-01", to: "2026-07-02" }) }));
  assert.equal(created.status, 201);
  assert.equal((await created.json()).token, "a".repeat(43));
  assert.equal((await route.REVOKE(new Request("http://test", { method: "POST" }), "s1")).status, 204);
});

test("public report share rejects invalid/revoked/inactive tokens as 404 and is read-only", async () => {
  const invalid = await publicClockifyReportShareRoute(new Request("http://test"), "bad", async () => { throw new Error("not called"); });
  assert.equal(invalid.status, 404);
  const inactive = await publicClockifyReportShareRoute(new Request("http://test"), "a".repeat(43), async () => { throw new ClockifyReportError(404, "Share not found"); });
  assert.equal(inactive.status, 404);
});

test("public report shares are unavailable when the global V2 flag is off without consulting rollout roles", async () => {
  const response = await publicClockifyReportShareRoute(new Request("http://test"), "a".repeat(43), async () => { throw new Error("not called"); }, () => false);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Not found" });
});
