CREATE TABLE "NotificationPreference" (
    "userId" TEXT NOT NULL,
    "appointmentUpdatesPush" BOOLEAN NOT NULL DEFAULT true,
    "appointmentRemindersPush" BOOLEAN NOT NULL DEFAULT true,
    "medicalResultsPush" BOOLEAN NOT NULL DEFAULT true,
    "prescriptionsPush" BOOLEAN NOT NULL DEFAULT true,
    "billingPush" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId")
);

ALTER TABLE "NotificationPreference"
ADD CONSTRAINT "NotificationPreference_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
