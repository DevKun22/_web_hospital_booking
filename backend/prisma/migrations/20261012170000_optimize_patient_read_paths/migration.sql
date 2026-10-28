ALTER TYPE "NotificationDeliveryStatus" ADD VALUE IF NOT EXISTS 'EXHAUSTED';

CREATE INDEX "Appointment_patientId_status_appointmentDate_idx"
ON "Appointment"("patientId", "status", "appointmentDate");

CREATE INDEX "MedicalRecord_patientId_status_publishedAt_idx"
ON "MedicalRecord"("patientId", "status", "publishedAt");

CREATE INDEX "Prescription_patientId_status_issuedAt_idx"
ON "Prescription"("patientId", "status", "issuedAt");

CREATE INDEX "Invoice_patientId_status_createdAt_idx"
ON "Invoice"("patientId", "status", "createdAt");
