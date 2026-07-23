import assert from "node:assert/strict";
import test from "node:test";
import { getClockifyCalendarRange, stepClockifyCalendarAnchor } from "./clockify-v2-calendar";

test("calendar ranges align Rome weeks and months before fetching entries", () => {
  assert.deepEqual(getClockifyCalendarRange("week", new Date("2026-07-22T12:00:00.000Z")), { from: "2026-07-20", to: "2026-07-26" });
  assert.deepEqual(getClockifyCalendarRange("month", new Date("2026-07-22T12:00:00.000Z")), { from: "2026-07-01", to: "2026-07-31" });
  assert.deepEqual(getClockifyCalendarRange("day", new Date("2026-07-22T12:00:00.000Z")), { from: "2026-07-22", to: "2026-07-22" });
});

test("month navigation advances calendar months without 29th–31st rollover", () => {
  assert.equal(stepClockifyCalendarAnchor("month", new Date("2026-01-31T12:00:00.000Z"), 1).toISOString(), "2026-02-01T12:00:00.000Z");
  assert.equal(stepClockifyCalendarAnchor("month", new Date("2024-01-31T12:00:00.000Z"), 1).toISOString(), "2024-02-01T12:00:00.000Z");
  assert.equal(stepClockifyCalendarAnchor("month", new Date("2026-03-30T12:00:00.000Z"), -1).toISOString(), "2026-02-01T12:00:00.000Z");
  assert.equal(stepClockifyCalendarAnchor("month", new Date("2026-12-31T12:00:00.000Z"), 1).toISOString(), "2027-01-01T12:00:00.000Z");
});
