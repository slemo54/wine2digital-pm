-- Performance indexes for commonly queried tables

-- Task indexes (filtering by project/status and ordering by updatedAt)
CREATE INDEX IF NOT EXISTS "Task_projectId_status_idx" ON "Task" ("projectId", "status");
CREATE INDEX IF NOT EXISTS "Task_projectId_updatedAt_idx" ON "Task" ("projectId", "updatedAt");
CREATE INDEX IF NOT EXISTS "Task_listId_idx" ON "Task" ("listId");

-- TaskComment index (loading comments for a task)
CREATE INDEX IF NOT EXISTS "TaskComment_taskId_createdAt_idx" ON "TaskComment" ("taskId", "createdAt");

-- Message index (chat history for a project)
CREATE INDEX IF NOT EXISTS "Message_projectId_createdAt_idx" ON "Message" ("projectId", "createdAt");

-- Notification indexes (user notifications and unread count)
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_idx" ON "Notification" ("userId", "isRead");

-- TaskAttachment index (loading attachments for a task)
CREATE INDEX IF NOT EXISTS "TaskAttachment_taskId_createdAt_idx" ON "TaskAttachment" ("taskId", "createdAt");
