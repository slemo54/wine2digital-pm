-- Add indexes to speed up task drawer loading
-- Subtasks are frequently fetched by taskId ordered by position.
-- Dependencies are frequently queried by dependsOnId (reverse lookup).

CREATE INDEX IF NOT EXISTS "Subtask_taskId_position_idx" ON "Subtask" ("taskId", "position");

CREATE INDEX IF NOT EXISTS "SubtaskDependency_dependsOnId_idx" ON "SubtaskDependency" ("dependsOnId");

