-- CreateEnum
CREATE TYPE "InvoiceItemType" AS ENUM ('CONSULTATION', 'PACKAGE', 'SERVICE_FEE', 'OTHER');

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "type" "InvoiceItemType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- Backfill the main examination/package charge for existing invoices.
INSERT INTO "InvoiceItem" (
    "id",
    "invoiceId",
    "type",
    "description",
    "quantity",
    "unitPrice",
    "amount",
    "sortOrder",
    "createdAt",
    "updatedAt"
)
SELECT
    md5(i."id" || ':primary-charge'),
    i."id",
    CASE
        WHEN a."packageId" IS NOT NULL THEN 'PACKAGE'::"InvoiceItemType"
        ELSE 'CONSULTATION'::"InvoiceItemType"
    END,
    CASE
        WHEN p."name" IS NOT NULL THEN 'Gói khám: ' || p."name"
        ELSE 'Phí khám: ' || d."name"
    END,
    1,
    GREATEST(i."totalAmount" - LEAST(GREATEST(a."serviceFee", 0), i."totalAmount"), 0),
    GREATEST(i."totalAmount" - LEAST(GREATEST(a."serviceFee", 0), i."totalAmount"), 0),
    0,
    i."createdAt",
    i."updatedAt"
FROM "Invoice" i
INNER JOIN "Appointment" a ON a."id" = i."appointmentId"
INNER JOIN "Department" d ON d."id" = a."departmentId"
LEFT JOIN "Package" p ON p."id" = a."packageId";

-- Backfill a separate service-fee line only when it is present.
INSERT INTO "InvoiceItem" (
    "id",
    "invoiceId",
    "type",
    "description",
    "quantity",
    "unitPrice",
    "amount",
    "sortOrder",
    "createdAt",
    "updatedAt"
)
SELECT
    md5(i."id" || ':service-fee'),
    i."id",
    'SERVICE_FEE'::"InvoiceItemType",
    'Phí dịch vụ đặt lịch',
    1,
    LEAST(GREATEST(a."serviceFee", 0), i."totalAmount"),
    LEAST(GREATEST(a."serviceFee", 0), i."totalAmount"),
    1,
    i."createdAt",
    i."updatedAt"
FROM "Invoice" i
INNER JOIN "Appointment" a ON a."id" = i."appointmentId"
WHERE a."serviceFee" > 0 AND i."totalAmount" > 0;

-- CreateIndex
CREATE INDEX "InvoiceItem_invoiceId_sortOrder_idx" ON "InvoiceItem"("invoiceId", "sortOrder");

-- AddForeignKey
ALTER TABLE "InvoiceItem" ADD CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
