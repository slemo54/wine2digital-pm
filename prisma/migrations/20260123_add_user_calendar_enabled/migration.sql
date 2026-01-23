-- Safe migration: add User.calendarEnabled without data loss.
-- Idempotent / defensive: works if column already exists or was created via db push.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'User'
      AND column_name = 'calendarEnabled'
  ) THEN
    ALTER TABLE "User" ADD COLUMN "calendarEnabled" BOOLEAN;
  END IF;
END $$;

-- Backfill for existing rows (and for the case the column existed but was nullable)
UPDATE "User"
SET "calendarEnabled" = TRUE
WHERE "calendarEnabled" IS NULL;

-- Enforce desired default and constraint
ALTER TABLE "User" ALTER COLUMN "calendarEnabled" SET DEFAULT TRUE;
ALTER TABLE "User" ALTER COLUMN "calendarEnabled" SET NOT NULL;

