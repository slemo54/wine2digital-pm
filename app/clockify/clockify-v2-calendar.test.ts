import assert from "node:assert/strict";
import test from "node:test";
import { getClockifyCalendarRange } from "./clockify-v2-calendar";

test("calendar ranges align Rome weeks and months before fetching entries", () => {
  assert.deepEqual(getClockifyCalendarRange("week", new Date("2026-07-22T12:00:00.000Z")), { from: "2026-07-20", to: "2026-07-26" });
  assert.deepEqual(getClockifyCalendarRange("month", new Date("2026-07-22T12:00:00.000Z")), { from: "2026-07-01", to: "2026-07-31" });
  assert.deepEqual(getClockifyCalendarRange("day", new Date("2026-07-22T12:00:00.000Z")), { from: "2026-07-22", to: "2026-07-22" });
});
