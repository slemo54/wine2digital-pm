-- Phase 5 reporting is read-heavy and always excludes soft-deleted entries.
-- Additive index only; it preserves legacy and V2 data.
CREATE INDEX IF NOT EXISTS "ClockifyEntry_deletedAt_workDate_idx"
ON "ClockifyEntry" ("deletedAt", "workDate");
