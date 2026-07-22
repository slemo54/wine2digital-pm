-- Phase 4 is additive. Existing period locks predate canonical writes, so
-- remove whitespace-only variants while application reads remain insensitive
-- during the rollout.
UPDATE "ClockifyLockPeriod"
SET "department" = NULLIF(btrim("department"), '')
WHERE "department" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "ClockifyLockPeriod_active_dates_idx"
ON "ClockifyLockPeriod" ("unlockedAt", "startDate", "endDate");

CREATE INDEX IF NOT EXISTS "ClockifyEntry_period_lock_idx"
ON "ClockifyEntry" ("lockKind", "lockPeriodId");
