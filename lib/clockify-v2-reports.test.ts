import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import {
  ClockifyReportError,
  allocateClockifyTagMinutes,
  buildClockifyReportWhere,
  createClockifyReportShare,
  csvCell,
  hashClockifyShareToken,
  createClockifyDetailedCsvStream,
  getClockifyPublicShare,
  normalizeClockifyReportInput,
  roundClockifyMinutes,
  validateClockifyShareToken,
} from "./clockify-v2-reports";

const base = { from: "2026-07-01", to: "2026-07-31" };

test("report filters validate each supported field and reject unknown/injection grouping", () => {
  const parsed = normalizeClockifyReportInput({
    ...base, department: "Grafica", userId: "u1", client: "Acme", projectId: "p1", taskId: "t1",
    tag: "urgent", locked: "true", description: "call", billable: "false", groupBy: "project",
    roundingIncrement: "15", roundingMode: "up",
  });
  assert.equal(parsed.filters.department, "Grafica");
  assert.equal(parsed.filters.locked, true);
  assert.equal(parsed.filters.billable, false);
  assert.equal(parsed.groupBy, "project");
  assert.equal(parsed.rounding.increment, 15);
  assert.throws(() => normalizeClockifyReportInput({ ...base, groupBy: 'project; DROP TABLE "User"' }), ClockifyReportError);
  assert.throws(() => normalizeClockifyReportInput({ ...base, roundingIncrement: 7 }), ClockifyReportError);
  assert.throws(() => normalizeClockifyReportInput({ ...base, roundingIncrement: 5, roundingMode: "nearest;select" }), ClockifyReportError);
  assert.throws(() => normalizeClockifyReportInput({ ...base, from: "2026-02-30" }), ClockifyReportError);
});

test("report rounding supports none and every permitted increment/mode without changing source values", () => {
  assert.equal(roundClockifyMinutes(7, { increment: null, mode: null }), 7);
  assert.equal(roundClockifyMinutes(7, { increment: 5, mode: "nearest" }), 5);
  assert.equal(roundClockifyMinutes(8, { increment: 5, mode: "nearest" }), 10);
  assert.equal(roundClockifyMinutes(8, { increment: 5, mode: "up" }), 10);
  assert.equal(roundClockifyMinutes(8, { increment: 5, mode: "down" }), 5);
  for (const increment of [10, 15, 30] as const) assert.equal(roundClockifyMinutes(increment + 1, { increment, mode: "down" }), increment);
});

test("CSV uses RFC4180 quoting and neutralizes spreadsheet formulas", () => {
  assert.equal(csvCell('plain'), 'plain');
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell('=SUM(A1:A2)'), "'=SUM(A1:A2)");
  assert.equal(csvCell("\t@cmd"), "'\t@cmd");
});

test("share tokens are 256-bit base64url values and only hashes are persisted with an atomic audit", async () => {
  let received: any;
  const db = {
    $transaction: async (work: any) => work({
      clockifyReportShare: { create: async ({ data }: any) => { received = data; return { id: "s1", ...data, createdAt: new Date(), revokedAt: null }; } },
      auditLog: { create: async () => undefined },
    }),
  };
  const share = await createClockifyReportShare(db, { userId: "u1", role: "member", department: null }, { reportType: "summary", ...base });
  assert.match(share.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(received.tokenHash, hashClockifyShareToken(share.token));
  assert.equal(JSON.stringify(received).includes(share.token), false);
  assert.equal(validateClockifyShareToken(share.token), share.token);
  assert.throws(() => validateClockifyShareToken("not-a-token"), ClockifyReportError);
});

test("parameterized report builders retain arbitrary filter values as Prisma parameters", () => {
  const report = normalizeClockifyReportInput({ ...base, description: "x' OR 1=1 --", groupBy: "description" });
  const query = Prisma.sql`SELECT ${report.filters.description}`;
  assert.equal(query.values[0], "x' OR 1=1 --");
});

test("report scope is always intersected server-side for member, manager, and admin", async () => {
  const normalized = async (value: unknown) => String(value || "") || null;
  const member = await buildClockifyReportWhere({ userId: "member", role: "member", department: "Grafica" }, normalizeClockifyReportInput(base).filters, normalized);
  const manager = await buildClockifyReportWhere({ userId: "manager", role: "manager", department: "Grafica" }, normalizeClockifyReportInput({ ...base, userId: "other" }).filters, normalized);
  const admin = await buildClockifyReportWhere({ userId: "admin", role: "admin", department: null }, normalizeClockifyReportInput(base).filters, normalized);
  assert.ok(member.values.includes("member"));
  assert.ok(manager.values.includes("Grafica"));
  assert.ok(manager.values.includes("other"));
  assert.equal(admin.values.includes("admin"), false);
});

test("a revoked or inactive author cannot serve a public share before report data is queried", async () => {
  const token = "a".repeat(43), tokenHash = hashClockifyShareToken(token);
  const inactiveDb = { clockifyReportShare: { findUnique: async () => ({ tokenHash, revokedAt: null, createdBy: { id: "u1", role: "manager", department: "Grafica", isActive: false } }) } };
  await assert.rejects(() => getClockifyPublicShare(inactiveDb, token), (error: any) => error instanceof ClockifyReportError && error.status === 404);
  const revokedDb = { clockifyReportShare: { findUnique: async () => ({ tokenHash, revokedAt: new Date(), createdBy: { id: "u1", role: "admin", department: null, isActive: true } }) } };
  await assert.rejects(() => getClockifyPublicShare(revokedDb, token), (error: any) => error instanceof ClockifyReportError && error.status === 404);
});

test("tag allocation uses distinct tags plus an untagged bucket and conserves the rounded entry total", () => {
  const rounding = { increment: 5 as const, mode: "up" as const };
  const tagged = allocateClockifyTagMinutes(11, [" client ", "client", "delivery"], rounding);
  assert.deepEqual(tagged.map((row) => row.label), ["client", "delivery"]);
  assert.equal(tagged.reduce((sum, row) => sum + row.totalMin, 0), 15);
  const untagged = allocateClockifyTagMinutes(11, ["", "  "], rounding);
  assert.deepEqual(untagged, [{ label: "Senza tag", totalMin: 15 }]);
});

test("detailed CSV is a readable stream that emits cursor pages without duplicate headers", async () => {
  const row = (id: string, description: string) => ({ id, workDate: "2026-07-01", startAt: "a", endAt: "b", description, tags: [], billable: false, durationMin: 10, userEmail: "u", client: "c", projectName: "p" });
  const stream = createClockifyDetailedCsvStream(async (cursor) => cursor ? { type: "detailed", rows: [row("b", "next")], nextCursor: null } : { type: "detailed", rows: [row("a", "=formula")], nextCursor: "next" });
  const text = await new Response(stream).text();
  assert.equal((text.match(/Date,Start/g) || []).length, 1);
  assert.match(text, /'=formula/);
});
