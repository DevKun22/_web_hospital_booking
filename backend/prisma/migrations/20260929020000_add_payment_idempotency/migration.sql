-- Nullable unique keys preserve existing rows while preventing duplicate active intents.
ALTER TABLE "PaymentTransaction"
ADD COLUMN "activeKey" TEXT,
ADD COLUMN "idempotencyKey" TEXT;

CREATE UNIQUE INDEX "PaymentTransaction_activeKey_key"
ON "PaymentTransaction"("activeKey");

CREATE UNIQUE INDEX "PaymentTransaction_idempotencyKey_key"
ON "PaymentTransaction"("idempotencyKey");
