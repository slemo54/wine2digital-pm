-- Subtask checklists (group + items)
CREATE TABLE "SubtaskChecklist" (
  "id" TEXT NOT NULL,
  "subtaskId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SubtaskChecklist_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubtaskChecklist_subtaskId_position_idx" ON "SubtaskChecklist"("subtaskId", "position");

ALTER TABLE "SubtaskChecklist"
ADD CONSTRAINT "SubtaskChecklist_subtaskId_fkey"
FOREIGN KEY ("subtaskId") REFERENCES "Subtask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SubtaskChecklistItem" (
  "id" TEXT NOT NULL,
  "checklistId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SubtaskChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SubtaskChecklistItem_checklistId_position_idx" ON "SubtaskChecklistItem"("checklistId", "position");

ALTER TABLE "SubtaskChecklistItem"
ADD CONSTRAINT "SubtaskChecklistItem_checklistId_fkey"
FOREIGN KEY ("checklistId") REFERENCES "SubtaskChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;


