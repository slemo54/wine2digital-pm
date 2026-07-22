import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migrationPath = resolve(
  process.cwd(),
  "prisma/migrations/20260722_clockify_v2_foundation/migration.sql"
);

test("Clockify V2 migration backfill only imports legacy projects when replayed", () => {
  const migration = readFileSync(migrationPath, "utf8");

  assert.match(
    migration,
    /-- Only projects without V2 ownership metadata are treated as legacy imports\./
  );
  assert.match(
    migration,
    /UPDATE "ClockifyProject"\s+SET "origin" = 'imported',\s+"createdById" = NULL,\s+"managerId" = NULL\s+WHERE "origin" = 'manual'\s+AND "createdById" IS NULL\s+AND "managerId" IS NULL;/
  );
});
