CREATE TABLE "DashboardLoginFailure" (
    "id" TEXT NOT NULL,
    "targetHash" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DashboardLoginFailure_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DashboardLoginFailure_targetHash_createdAt_idx"
ON "DashboardLoginFailure"("targetHash", "createdAt");

CREATE INDEX "DashboardLoginFailure_ipHash_createdAt_idx"
ON "DashboardLoginFailure"("ipHash", "createdAt");
