-- Clockify V2 foundation. This migration only adds tables, nullable columns,
-- foreign keys, and indexes; legacy Clockify data remains intact.

CREATE TABLE "ClockifyClient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClockifyClient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClockifyTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClockifyTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClockifyLockPeriod" (
    "id" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "scopeType" TEXT NOT NULL,
    "department" TEXT,
    "targetUserId" TEXT,
    "createdById" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3),
    "unlockedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClockifyLockPeriod_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClockifyReportShare" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "groupBy" TEXT,
    "roundingIncrement" INTEGER,
    "roundingMode" TEXT,
    "createdById" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClockifyReportShare_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ClockifyProject"
    ADD COLUMN "clientId" TEXT,
    ADD COLUMN "color" TEXT NOT NULL DEFAULT '#6B7280',
    ADD COLUMN "origin" TEXT NOT NULL DEFAULT 'manual',
    ADD COLUMN "createdById" TEXT,
    ADD COLUMN "managerId" TEXT,
    ADD COLUMN "archivedAt" TIMESTAMP(3),
    ADD COLUMN "archivedById" TEXT;

ALTER TABLE "ClockifyEntry"
    ADD COLUMN "taskId" TEXT,
    ADD COLUMN "lockedAt" TIMESTAMP(3),
    ADD COLUMN "lockedById" TEXT,
    ADD COLUMN "lockKind" TEXT,
    ADD COLUMN "lockPeriodId" TEXT,
    ADD COLUMN "deletedAt" TIMESTAMP(3),
    ADD COLUMN "deletedById" TEXT;

CREATE UNIQUE INDEX "ClockifyClient_normalizedName_key" ON "ClockifyClient"("normalizedName");
CREATE INDEX "ClockifyClient_createdById_idx" ON "ClockifyClient"("createdById");
CREATE UNIQUE INDEX "ClockifyTask_projectId_normalizedName_key" ON "ClockifyTask"("projectId", "normalizedName");
CREATE INDEX "ClockifyTask_projectId_isActive_idx" ON "ClockifyTask"("projectId", "isActive");
CREATE INDEX "ClockifyTask_createdById_idx" ON "ClockifyTask"("createdById");
CREATE INDEX "ClockifyProject_createdById_idx" ON "ClockifyProject"("createdById");
CREATE INDEX "ClockifyProject_managerId_idx" ON "ClockifyProject"("managerId");
CREATE INDEX "ClockifyProject_clientId_idx" ON "ClockifyProject"("clientId");
CREATE INDEX "ClockifyEntry_userId_workDate_startAt_idx" ON "ClockifyEntry"("userId", "workDate", "startAt");
CREATE INDEX "ClockifyEntry_taskId_workDate_idx" ON "ClockifyEntry"("taskId", "workDate");
CREATE INDEX "ClockifyEntry_lockedAt_idx" ON "ClockifyEntry"("lockedAt");
CREATE INDEX "ClockifyEntry_deletedAt_idx" ON "ClockifyEntry"("deletedAt");
CREATE INDEX "ClockifyLockPeriod_startDate_endDate_idx" ON "ClockifyLockPeriod"("startDate", "endDate");
CREATE INDEX "ClockifyLockPeriod_scopeType_idx" ON "ClockifyLockPeriod"("scopeType");
CREATE INDEX "ClockifyLockPeriod_targetUserId_idx" ON "ClockifyLockPeriod"("targetUserId");
CREATE UNIQUE INDEX "ClockifyReportShare_tokenHash_key" ON "ClockifyReportShare"("tokenHash");
CREATE INDEX "ClockifyReportShare_revokedAt_idx" ON "ClockifyReportShare"("revokedAt");
CREATE INDEX "ClockifyReportShare_createdById_idx" ON "ClockifyReportShare"("createdById");

ALTER TABLE "ClockifyClient"
    ADD CONSTRAINT "ClockifyClient_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClockifyProject"
    ADD CONSTRAINT "ClockifyProject_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "ClockifyClient"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "ClockifyProject_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "ClockifyProject_managerId_fkey"
    FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "ClockifyProject_archivedById_fkey"
    FOREIGN KEY ("archivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClockifyTask"
    ADD CONSTRAINT "ClockifyTask_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "ClockifyProject"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "ClockifyTask_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClockifyEntry"
    ADD CONSTRAINT "ClockifyEntry_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "ClockifyTask"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "ClockifyEntry_lockedById_fkey"
    FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "ClockifyEntry_lockPeriodId_fkey"
    FOREIGN KEY ("lockPeriodId") REFERENCES "ClockifyLockPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "ClockifyEntry_deletedById_fkey"
    FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClockifyLockPeriod"
    ADD CONSTRAINT "ClockifyLockPeriod_targetUserId_fkey"
    FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "ClockifyLockPeriod_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "ClockifyLockPeriod_unlockedById_fkey"
    FOREIGN KEY ("unlockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ClockifyReportShare"
    ADD CONSTRAINT "ClockifyReportShare_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "ClockifyReportShare_revokedById_fkey"
    FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Deterministic IDs and ON CONFLICT make the data backfill safe to re-run.
WITH normalized_clients AS (
    SELECT
        CASE
            WHEN btrim("client") = '' THEN 'senza cliente'
            ELSE lower(btrim("client"))
        END AS "normalizedName",
        CASE
            WHEN btrim("client") = '' THEN 'Senza cliente'
            ELSE btrim("client")
        END AS "name"
    FROM "ClockifyProject"
), distinct_clients AS (
    SELECT "normalizedName", MIN("name") AS "name"
    FROM normalized_clients
    GROUP BY "normalizedName"
)
INSERT INTO "ClockifyClient" ("id", "name", "normalizedName", "createdAt", "updatedAt")
SELECT
    md5('clockify-client:' || "normalizedName"),
    "name",
    "normalizedName",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM distinct_clients
ON CONFLICT ("normalizedName") DO NOTHING;

UPDATE "ClockifyProject" AS project
SET "clientId" = client."id"
FROM "ClockifyClient" AS client
WHERE project."clientId" IS NULL
  AND client."normalizedName" = CASE
      WHEN btrim(project."client") = '' THEN 'senza cliente'
      ELSE lower(btrim(project."client"))
  END;

-- All rows present while this migration runs are legacy imported projects.
UPDATE "ClockifyProject"
SET "origin" = 'imported',
    "createdById" = NULL,
    "managerId" = NULL;
