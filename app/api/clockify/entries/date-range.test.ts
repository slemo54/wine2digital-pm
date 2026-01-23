import test from "node:test";
import assert from "node:assert/strict";
import { parseClockifyWorkDateFilter } from "./date-range";

test("clockify date filter: day requires YYYY-MM-DD", () => {
  const r = parseClockifyWorkDateFilter({ date: "2026-01-13" });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.filter.kind, "day");
});

test("clockify date filter: range requires from+to and validates order", () => {
  const ok = parseClockifyWorkDateFilter({ from: "2026-01-01", to: "2026-01-31" });
  assert.equal(ok.ok, true);

  const bad = parseClockifyWorkDateFilter({ from: "2026-01-31", to: "2026-01-01" });
  assert.equal(bad.ok, false);
});

