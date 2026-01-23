-- Create TaskList (categories per project)
CREATE TABLE "TaskList" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TaskList_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaskList_projectId_name_key" ON "TaskList"("projectId", "name");
CREATE INDEX "TaskList_projectId_updatedAt_idx" ON "TaskList"("projectId", "updatedAt");

ALTER TABLE "TaskList"
ADD CONSTRAINT "TaskList_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add listId to Task (new category relation)
ALTER TABLE "Task" ADD COLUMN "listId" TEXT;

ALTER TABLE "Task"
ADD CONSTRAINT "Task_listId_fkey"
FOREIGN KEY ("listId") REFERENCES "TaskList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Subtask comments
CREATE TABLE "SubtaskComment" (
  "id" TEXT NOT NULL,
  "subtaskId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SubtaskComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubtaskComment_subtaskId_createdAt_idx" ON "SubtaskComment"("subtaskId", "createdAt");

ALTER TABLE "SubtaskComment"
ADD CONSTRAINT "SubtaskComment_subtaskId_fkey"
FOREIGN KEY ("subtaskId") REFERENCES "Subtask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubtaskComment"
ADD CONSTRAINT "SubtaskComment_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Subtask attachments
CREATE TABLE "SubtaskAttachment" (
  "id" TEXT NOT NULL,
  "subtaskId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "mimeType" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "uploadedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SubtaskAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubtaskAttachment_subtaskId_createdAt_idx" ON "SubtaskAttachment"("subtaskId", "createdAt");

ALTER TABLE "SubtaskAttachment"
ADD CONSTRAINT "SubtaskAttachment_subtaskId_fkey"
FOREIGN KEY ("subtaskId") REFERENCES "Subtask"("id") ON DELETE CASCADE ON UPDATE CASCADE;


