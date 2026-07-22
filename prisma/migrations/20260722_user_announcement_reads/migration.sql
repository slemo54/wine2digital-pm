CREATE TABLE "UserAnnouncementRead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "announcementKey" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAnnouncementRead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserAnnouncementRead_userId_announcementKey_key"
ON "UserAnnouncementRead"("userId", "announcementKey");

CREATE INDEX "UserAnnouncementRead_announcementKey_idx"
ON "UserAnnouncementRead"("announcementKey");

ALTER TABLE "UserAnnouncementRead"
ADD CONSTRAINT "UserAnnouncementRead_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
