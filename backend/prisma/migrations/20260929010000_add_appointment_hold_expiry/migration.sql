-- Additive booking-hold deadline used by the appointment lifecycle worker.
ALTER TABLE "Appointment" ADD COLUMN "holdExpiresAt" TIMESTAMP(3);

CREATE INDEX "Appointment_status_holdExpiresAt_idx"
ON "Appointment"("status", "holdExpiresAt");
