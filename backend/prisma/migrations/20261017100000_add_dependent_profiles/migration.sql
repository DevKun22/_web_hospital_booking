CREATE TYPE "DependentRelationship" AS ENUM (
    'CHILD',
    'SPOUSE',
    'PARENT',
    'SIBLING',
    'OTHER'
);

CREATE TABLE "DependentProfile" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "relationship" "DependentRelationship" NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "gender" "Gender",
    "cccd" TEXT,
    "address" TEXT,
    "hasBHYT" BOOLEAN NOT NULL DEFAULT false,
    "healthInsuranceCode" TEXT,
    "registeredHospital" TEXT,
    "allergies" TEXT,
    "medicalHistory" TEXT,
    "familyHistory" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DependentProfile_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Appointment" ADD COLUMN "dependentProfileId" TEXT;

CREATE UNIQUE INDEX "DependentProfile_ownerId_cccd_key"
ON "DependentProfile"("ownerId", "cccd");

CREATE INDEX "DependentProfile_ownerId_isActive_idx"
ON "DependentProfile"("ownerId", "isActive");

CREATE INDEX "Appointment_dependentProfileId_appointmentDate_idx"
ON "Appointment"("dependentProfileId", "appointmentDate");

ALTER TABLE "DependentProfile"
ADD CONSTRAINT "DependentProfile_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Appointment"
ADD CONSTRAINT "Appointment_dependentProfileId_fkey"
FOREIGN KEY ("dependentProfileId") REFERENCES "DependentProfile"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
