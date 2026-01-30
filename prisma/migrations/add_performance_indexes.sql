-- Migration: Add Performance Indexes
-- Created: 2026-01-30
-- Description: Aggiunge indici critici per ottimizzare le query più frequenti

-- Indici per Task
-- Ottimizza query: "SELECT * FROM Task WHERE projectId = ? AND status = ? ORDER BY updatedAt"
CREATE INDEX IF NOT EXISTS "Task_projectId_status_updatedAt_idx" ON "Task"("projectId", "status", "updatedAt");

-- Ottimizza query: "SELECT * FROM Task WHERE status = ?"
CREATE INDEX IF NOT EXISTS "Task_status_idx" ON "Task"("status");

-- Ottimizza query: "SELECT * FROM Task WHERE dueDate <= ?"
CREATE INDEX IF NOT EXISTS "Task_dueDate_idx" ON "Task"("dueDate");

-- Indici per TaskAssignee
-- Ottimizza query: "SELECT * FROM TaskAssignee WHERE userId = ? AND taskId = ?"
CREATE INDEX IF NOT EXISTS "TaskAssignee_userId_taskId_idx" ON "TaskAssignee"("userId", "taskId");

-- Indici per Subtask
-- Ottimizza query: "SELECT * FROM Subtask WHERE assigneeId = ? AND status = ?"
CREATE INDEX IF NOT EXISTS "Subtask_assigneeId_status_idx" ON "Subtask"("assigneeId", "status");

-- Ottimizza query: "SELECT * FROM Subtask WHERE taskId = ? AND status = ? ORDER BY position"
CREATE INDEX IF NOT EXISTS "Subtask_taskId_status_position_idx" ON "Subtask"("taskId", "status", "position");

-- Indici per Notification
-- Ottimizza query: "SELECT * FROM Notification WHERE userId = ? AND isRead = ? ORDER BY createdAt DESC"
CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- Ottimizza query: "SELECT * FROM Notification WHERE userId = ? ORDER BY createdAt DESC"
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- Commit changes
COMMIT;
