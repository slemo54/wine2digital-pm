import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_BULK_DELETE_IDS,
  buildAdminAbsencesWhere,
  parseOptionalDate,
  parseOptionalInt,
  validateBulkDeleteInput,
} from "./admin-absences-filters";

test("parseOptionalInt", () => {
  assert.equal(parseOptionalInt(null), null);
  assert.equal(parseOptionalInt(""), null);
  assert.equal(parseOptionalInt("  "), null);
  assert.equal(parseOptionalInt("10"), 10);
  assert.equal(parseOptionalInt("10.9"), 10);
  assert.equal(parseOptionalInt("abc"), null);
});

test("parseOptionalDate", () => {
  assert.equal(parseOptionalDate(null), null);
  assert.equal(parseOptionalDate(""), null);
  assert.equal(parseOptionalDate("  "), null);
  assert.equal(parseOptionalDate("not-a-date"), null);
  const d = parseOptionalDate("2025-01-01T00:00:00.000Z");
  assert.ok(d instanceof Date);
  assert.equal(d?.toISOString(), "2025-01-01T00:00:00.000Z");
});

test("buildAdminAbsencesWhere builds where and countsWhere", () => {
  const from = new Date("2025-01-01T00:00:00.000Z");
  const to = new Date("2025-01-31T23:59:59.000Z");
  const createdFrom = new Date("2025-02-01T00:00:00.000Z");
  const createdTo = new Date("2025-02-28T23:59:59.000Z");

  const { where, countsWhere } = buildAdminAbsencesWhere({
    q: "mario",
    statusParam: "approved",
    typeParam: "vacation",
    from,
    to,
    createdFrom,
    createdTo,
  });

  assert.deepEqual(where, {
    AND: [
      {
        OR: [
          { reason: { contains: "mario", mode: "insensitive" } },
          { user: { email: { contains: "mario", mode: "insensitive" } } },
          { user: { name: { contains: "mario", mode: "insensitive" } } },
          { user: { firstName: { contains: "mario", mode: "insensitive" } } },
          { user: { lastName: { contains: "mario", mode: "insensitive" } } },
        ],
      },
      { status: "approved" },
      { type: "vacation" },
      { startDate: { lte: to }, endDate: { gte: from } },
      { createdAt: { gte: createdFrom, lte: createdTo } },
    ],
  });

  // countsWhere excludes status filter
  assert.deepEqual(countsWhere, {
    AND: [
      {
        OR: [
          { reason: { contains: "mario", mode: "insensitive" } },
          { user: { email: { contains: "mario", mode: "insensitive" } } },
          { user: { name: { contains: "mario", mode: "insensitive" } } },
          { user: { firstName: { contains: "mario", mode: "insensitive" } } },
          { user: { lastName: { contains: "mario", mode: "insensitive" } } },
        ],
      },
      { type: "vacation" },
      { startDate: { lte: to }, endDate: { gte: from } },
      { createdAt: { gte: createdFrom, lte: createdTo } },
    ],
  });
});

test("validateBulkDeleteInput errors on missing criteria", () => {
  const r = validateBulkDeleteInput({});
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /Provide either/);
});

test("validateBulkDeleteInput errors on too many ids", () => {
  const ids = Array.from({ length: MAX_BULK_DELETE_IDS + 1 }, (_, i) => `id-${i}`);
  const r = validateBulkDeleteInput({ ids });
  assert.equal(r.ok, false);
  if (!r.ok) assert.match(r.error, /Too many ids/);
});

test("validateBulkDeleteInput errors on invalid dates", () => {
  const r1 = validateBulkDeleteInput({ before: "nope" });
  assert.equal(r1.ok, false);
  const r2 = validateBulkDeleteInput({ createdFrom: "nope", createdTo: "2025-01-01T00:00:00.000Z" });
  assert.equal(r2.ok, false);
});

test("validateBulkDeleteInput errors on createdFrom > createdTo", () => {
  const r = validateBulkDeleteInput({
    createdFrom: "2025-02-01T00:00:00.000Z",
    createdTo: "2025-01-01T00:00:00.000Z",
  });
  assert.equal(r.ok, false);
});

test("validateBulkDeleteInput builds where by ids / before / range", () => {
  const rIds = validateBulkDeleteInput({ ids: [" a ", "b", "a"] });
  assert.equal(rIds.ok, true);
  if (rIds.ok) {
    assert.deepEqual(rIds.where, { id: { in: ["a", "b"] } });
  }

  const rBefore = validateBulkDeleteInput({ before: "2025-01-01T00:00:00.000Z" });
  assert.equal(rBefore.ok, true);
  if (rBefore.ok) {
    assert.deepEqual(rBefore.where, { createdAt: { lt: new Date("2025-01-01T00:00:00.000Z") } });
  }

  const rRange = validateBulkDeleteInput({
    createdFrom: "2025-01-01T00:00:00.000Z",
    createdTo: "2025-01-31T23:59:59.000Z",
  });
  assert.equal(rRange.ok, true);
  if (rRange.ok) {
    assert.deepEqual(rRange.where, {
      createdAt: {
        gte: new Date("2025-01-01T00:00:00.000Z"),
        lte: new Date("2025-01-31T23:59:59.000Z"),
      },
    });
  }
});

