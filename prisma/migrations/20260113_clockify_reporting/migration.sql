-- CreateTable
CREATE TABLE "ClockifyProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "client" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClockifyProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClockifyEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "task" TEXT,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "billable" BOOLEAN NOT NULL DEFAULT false,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClockifyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClockifyProject_name_client_key" ON "ClockifyProject"("name", "client");

-- CreateIndex
CREATE INDEX "ClockifyProject_isActive_idx" ON "ClockifyProject"("isActive");

-- CreateIndex
CREATE INDEX "ClockifyEntry_userId_workDate_idx" ON "ClockifyEntry"("userId", "workDate");

-- CreateIndex
CREATE INDEX "ClockifyEntry_projectId_workDate_idx" ON "ClockifyEntry"("projectId", "workDate");

-- CreateIndex
CREATE INDEX "ClockifyEntry_startAt_idx" ON "ClockifyEntry"("startAt");

-- AddForeignKey
ALTER TABLE "ClockifyEntry"
ADD CONSTRAINT "ClockifyEntry_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClockifyEntry"
ADD CONSTRAINT "ClockifyEntry_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "ClockifyProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

