import assert from "node:assert/strict";
import test from "node:test";
import { layoutClockifyDaySegments, segmentClockifyEntriesByRomeDay } from "./clockify-v2-calendar-layout";

const entry = {
  id: "e1",
  startAt: "2026-07-22T21:30:00.000Z",
  endAt: "2026-07-23T00:30:00.000Z",
};

test("calendar segments an entry crossing Rome midnight without duplicating its identity", () => {
  const segments = segmentClockifyEntriesByRomeDay([entry]);
  assert.deepEqual(segments.map((segment) => ({
    entryId: segment.entryId,
    date: segment.date,
    startMinute: segment.startMinute,
    endMinute: segment.endMinute,
  })), [
    { entryId: "e1", date: "2026-07-22", startMinute: 1410, endMinute: 1440 },
    { entryId: "e1", date: "2026-07-23", startMinute: 0, endMinute: 150 },
  ]);
});

test("overlapping segments are assigned adjacent columns while later entries reuse space", () => {
  const laidOut = layoutClockifyDaySegments([
    { entryId: "a", date: "2026-07-22", startMinute: 540, endMinute: 660, source: { id: "a" } },
    { entryId: "b", date: "2026-07-22", startMinute: 600, endMinute: 720, source: { id: "b" } },
    { entryId: "c", date: "2026-07-22", startMinute: 720, endMinute: 780, source: { id: "c" } },
  ]);
  assert.deepEqual(laidOut.map(({ entryId, column, columnCount }) => ({ entryId, column, columnCount })), [
    { entryId: "a", column: 0, columnCount: 2 },
    { entryId: "b", column: 1, columnCount: 2 },
    { entryId: "c", column: 0, columnCount: 1 },
  ]);
});
