import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const migrationPath = resolve(
  process.cwd(),
  "prisma/migrations/20260722_clockify_v2_foundation/migration.sql"
);

test("Clockify V2 migration durably scopes the project backfill to migration-time legacy rows", () => {
  const migration = readFileSync(migrationPath, "utf8");

  assert.match(
    migration,
    /ADD COLUMN "origin" TEXT,/,
  );
  assert.doesNotMatch(migration, /ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'manual',/);
  assert.match(
    migration,
    /-- Only rows created before the V2 origin column existed have a NULL origin\./,
  );
  assert.match(
    migration,
    /UPDATE "ClockifyProject"\s+SET "origin" = 'imported',\s+"createdById" = NULL,\s+"managerId" = NULL\s+WHERE "origin" IS NULL;/,
  );
  assert.doesNotMatch(migration, /WHERE "origin" = 'manual'\s+AND "createdById" IS NULL/);
  assert.match(
    migration,
    /ALTER TABLE "ClockifyProject" ALTER COLUMN "origin" SET DEFAULT 'manual';\s+ALTER TABLE "ClockifyProject" ALTER COLUMN "origin" SET NOT NULL;/,
  );
});
