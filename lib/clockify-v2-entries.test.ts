import assert from "node:assert/strict";
import test from "node:test";
import {
  ClockifyEntryError,
  buildClockifyEntryTiming,
  entryWarnings,
  groupClockifyEntries,
} from "./clockify-v2-entries";

test("V2 entry timing requires exactly one endAt or durationMin", () => {
  assert.throws(
    () => buildClockifyEntryTiming({ date: "2026-07-22", startTime: "09:00", endAt: "10:00", durationMin: 60 }),
    (error: unknown) => error instanceof ClockifyEntryError && error.status === 400,
  );
  assert.throws(
    () => buildClockifyEntryTiming({ date: "2026-07-22", startTime: "09:00" }),
    /exactly one/i,
  );
});

test("V2 entry timing interprets Europe/Rome wall time across DST and rejects the spring gap", () => {
  const spring = buildClockifyEntryTiming({ date: "2026-03-29", startTime: "01:30", durationMin: 60 });
  assert.equal(spring.startAt.toISOString(), "2026-03-29T00:30:00.000Z");
  assert.equal(spring.endAt.toISOString(), "2026-03-29T01:30:00.000Z");
  assert.equal(spring.workDate.toISOString(), "2026-03-28T23:00:00.000Z");
  assert.throws(() => buildClockifyEntryTiming({ date: "2026-03-29", startTime: "02:30", durationMin: 30 }), /does not exist/i);

  const autumn = buildClockifyEntryTiming({ date: "2026-10-25", startTime: "02:30", durationMin: 30 });
  assert.equal(autumn.startAt.toISOString(), "2026-10-25T00:30:00.000Z");
  assert.equal(autumn.endAt.toISOString(), "2026-10-25T01:00:00.000Z");
});

test("V2 entry warnings remain non-blocking for overlaps and anomalous durations", () => {
  const startAt = new Date("2026-07-22T08:00:00.000Z");
  const endAt = new Date("2026-07-22T08:03:00.000Z");
  assert.deepEqual(entryWarnings({ startAt, endAt, durationMin: 3, overlaps: 1 }).map((warning) => warning.code), ["overlap", "duration_short"]);
  assert.deepEqual(entryWarnings({ startAt, endAt: new Date(startAt.getTime() + 13 * 60 * 60 * 1000), durationMin: 13 * 60, overlaps: 0 }).map((warning) => warning.code), ["duration_long"]);
});

test("V2 entry list grouping returns bounded daily, weekly and period totals", () => {
  const result = groupClockifyEntries([
    { id: "a", workDate: new Date("2026-07-20T22:00:00.000Z"), durationMin: 60, billable: true },
    { id: "b", workDate: new Date("2026-07-21T22:00:00.000Z"), durationMin: 30, billable: false },
  ]);
  assert.equal(result.period.totalMin, 90);
  assert.equal(result.period.billableMin, 60);
  assert.equal(result.days.length, 2);
  assert.equal(result.weeks.length, 1);
});
