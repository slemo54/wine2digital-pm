import test from "node:test";
import assert from "node:assert/strict";
import { buildProjectDateOverlapWhere, parseDateRangeInput } from "./projects-date-filter";

test("parseDateRangeInput validates invalid dates and inverted range", () => {
  assert.deepEqual(parseDateRangeInput({ startDate: null, endDate: null }), { ok: true, start: null, end: null });
  assert.equal(parseDateRangeInput({ startDate: "nope", endDate: null }).ok, false);
  assert.equal(parseDateRangeInput({ startDate: null, endDate: "nope" }).ok, false);
  assert.equal(parseDateRangeInput({ startDate: "2025-12-31", endDate: "2025-01-01" }).ok, false);
});

test("buildProjectDateOverlapWhere creates overlap where fragment", () => {
  const parsed = parseDateRangeInput({ startDate: "2025-01-01", endDate: "2025-01-31" });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;

  const where = buildProjectDateOverlapWhere({ start: parsed.start, end: parsed.end }) as any;
  assert.ok(where.AND);
  assert.equal(Array.isArray(where.AND), true);
});


