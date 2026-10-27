CREATE TYPE "NotificationType" AS ENUM (
  'APPOINTMENT_CONFIRMED',
  'APPOINTMENT_RESCHEDULED',
  'APPOINTMENT_CANCELLED',
  'APPOINTMENT_REMINDER'
);

CREATE TYPE "NotificationDeliveryStatus" AS ENUM (
  'PENDING',
  'SENT',
  'FAILED',
  'CANCELLED',
  'INVALID_TOKEN'
);

ALTER TABLE "DashboardSession"
ADD COLUMN "pushToken" TEXT,
ADD COLUMN "pushTokenUpdatedAt" TIMESTAMP(3),
ADD COLUMN "pushDisabledAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "DashboardSession_pushToken_key"
ON "DashboardSession"("pushToken");

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "dedupeKey" TEXT,
  "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  "dispatchedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "readAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationDelivery" (
  "id" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "providerMessageId" TEXT,
  "lastError" TEXT,
  "nextAttemptAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Notification_dedupeKey_key"
ON "Notification"("dedupeKey");
CREATE INDEX "Notification_userId_publishedAt_idx"
ON "Notification"("userId", "publishedAt");
CREATE INDEX "Notification_userId_readAt_publishedAt_idx"
ON "Notification"("userId", "readAt", "publishedAt");
CREATE INDEX "Notification_scheduledAt_publishedAt_cancelledAt_idx"
ON "Notification"("scheduledAt", "publishedAt", "cancelledAt");
CREATE INDEX "Notification_entityType_entityId_idx"
ON "Notification"("entityType", "entityId");

CREATE UNIQUE INDEX "NotificationDelivery_notificationId_sessionId_key"
ON "NotificationDelivery"("notificationId", "sessionId");
CREATE INDEX "NotificationDelivery_status_nextAttemptAt_idx"
ON "NotificationDelivery"("status", "nextAttemptAt");
CREATE INDEX "NotificationDelivery_sessionId_status_idx"
ON "NotificationDelivery"("sessionId", "status");

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationDelivery"
ADD CONSTRAINT "NotificationDelivery_notificationId_fkey"
FOREIGN KEY ("notificationId") REFERENCES "Notification"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationDelivery"
ADD CONSTRAINT "NotificationDelivery_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "DashboardSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
