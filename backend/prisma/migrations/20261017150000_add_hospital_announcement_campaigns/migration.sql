ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'SYSTEM_ANNOUNCEMENT';

ALTER TABLE "Notification"
ADD COLUMN "campaignId" TEXT,
ADD COLUMN "createdById" TEXT;

CREATE INDEX "Notification_campaignId_createdAt_idx"
ON "Notification"("campaignId", "createdAt");

ALTER TABLE "NotificationPreference"
ADD COLUMN "generalAnnouncementsPush" BOOLEAN NOT NULL DEFAULT true;
