-- AlterTable
ALTER TABLE "ProjectTag" ADD COLUMN "color" TEXT DEFAULT '#94a3b8';

-- Backfill existing tags with the default color
UPDATE "ProjectTag" SET "color" = '#94a3b8' WHERE "color" IS NULL;
