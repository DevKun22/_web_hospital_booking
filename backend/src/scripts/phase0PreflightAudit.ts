import "dotenv/config";
import { prisma } from "../config/prisma.js";

const serialize = (value: unknown) =>
  JSON.stringify(
    value,
    (_key, item) => (typeof item === "bigint" ? item.toString() : item),
    2,
  );

const main = async () => {
  const [appointmentIntegrity, duplicatePayments, paymentIntegrity, patients] =
    await Promise.all([
      prisma.$queryRaw`
        SELECT
          COUNT(*) FILTER (
            WHERE a.status = 'PENDING_OTP'
              AND a."createdAt" + INTERVAL '10 minutes' <= NOW()
          ) AS "expiredPendingOtp",
          COUNT(*) FILTER (
            WHERE a.status IN ('CANCELLED_BY_PATIENT', 'CANCELLED_BY_DOCTOR', 'CANCELLED_BY_ADMIN', 'NO_SHOW')
              AND s.status = 'BOOKED'
          ) AS "terminalWithBookedSlot",
          COUNT(*) FILTER (
            WHERE a.status IN ('PENDING_OTP', 'PENDING_CONFIRM', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS')
              AND s.status = 'AVAILABLE'
          ) AS "activeWithAvailableSlot"
        FROM "Appointment" a
        LEFT JOIN "DoctorTimeSlot" s ON s.id = a."timeSlotId"
      `,
      prisma.$queryRaw`
        SELECT "invoiceId", provider, COUNT(*) AS count
        FROM "PaymentTransaction"
        WHERE status = 'PENDING' AND "expiredAt" > NOW()
        GROUP BY "invoiceId", provider
        HAVING COUNT(*) > 1
      `,
      prisma.$queryRaw`
        SELECT
          COUNT(*) FILTER (
            WHERE i.status = 'PAID' AND NOT EXISTS (
              SELECT 1 FROM "PaymentTransaction" p
              WHERE p."invoiceId" = i.id AND p.status = 'SUCCESS'
            )
          ) AS "paidWithoutSuccess",
          COUNT(*) FILTER (
            WHERE i.status <> 'PAID' AND EXISTS (
              SELECT 1 FROM "PaymentTransaction" p
              WHERE p."invoiceId" = i.id AND p.status = 'SUCCESS'
            )
          ) AS "successWithoutPaidInvoice"
        FROM "Invoice" i
      `,
      prisma.$queryRaw`
        SELECT
          COUNT(*) AS "unverifiedPatients",
          COUNT(*) FILTER (
            WHERE EXISTS (SELECT 1 FROM "MedicalRecord" m WHERE m."patientId" = u.id)
               OR EXISTS (SELECT 1 FROM "Invoice" i WHERE i."patientId" = u.id)
          ) AS "unverifiedWithClinicalOrBillingData"
        FROM "User" u
        WHERE u.role = 'PATIENT' AND u."isPhoneVerified" = FALSE
      `,
    ]);

  console.log(
    serialize({
      generatedAt: new Date().toISOString(),
      readOnly: true,
      appointmentIntegrity,
      duplicateActivePayments: duplicatePayments,
      paymentIntegrity,
      provisionalPatients: patients,
    }),
  );
};

main()
  .catch((error) => {
    console.error("[PHASE0_PREFLIGHT_AUDIT] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
