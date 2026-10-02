CREATE TYPE "SessionKind" AS ENUM ('DASHBOARD', 'PATIENT');

ALTER TABLE "DashboardSession"
ADD COLUMN "kind" "SessionKind" NOT NULL DEFAULT 'DASHBOARD',
ADD COLUMN "tokenFamilyId" TEXT,
ADD COLUMN "deviceId" TEXT,
ADD COLUMN "deviceName" TEXT,
ADD COLUMN "platform" TEXT,
ADD COLUMN "appVersion" TEXT;

UPDATE "DashboardSession"
SET "tokenFamilyId" = "id"
WHERE "tokenFamilyId" IS NULL;

ALTER TABLE "DashboardSession"
ALTER COLUMN "tokenFamilyId" SET NOT NULL;

CREATE UNIQUE INDEX "DashboardSession_tokenFamilyId_key"
ON "DashboardSession"("tokenFamilyId");

CREATE INDEX "DashboardSession_userId_kind_revokedAt_idx"
ON "DashboardSession"("userId", "kind", "revokedAt");

CREATE TABLE "AuthRefreshToken" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "replacedByTokenHash" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuthRefreshToken_pkey" PRIMARY KEY ("id")
);

INSERT INTO "AuthRefreshToken" (
  "id", "sessionId", "userId", "tokenHash", "expiresAt", "revokedAt", "createdAt"
)
SELECT
  md5("id" || ':' || "refreshTokenHash"), "id", "userId", "refreshTokenHash", "expiresAt", "revokedAt", "createdAt"
FROM "DashboardSession";

CREATE UNIQUE INDEX "AuthRefreshToken_tokenHash_key"
ON "AuthRefreshToken"("tokenHash");
CREATE INDEX "AuthRefreshToken_sessionId_createdAt_idx"
ON "AuthRefreshToken"("sessionId", "createdAt");
CREATE INDEX "AuthRefreshToken_userId_expiresAt_idx"
ON "AuthRefreshToken"("userId", "expiresAt");
CREATE INDEX "AuthRefreshToken_expiresAt_idx"
ON "AuthRefreshToken"("expiresAt");
CREATE INDEX "AuthRefreshToken_revokedAt_idx"
ON "AuthRefreshToken"("revokedAt");

ALTER TABLE "AuthRefreshToken"
ADD CONSTRAINT "AuthRefreshToken_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "DashboardSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuthRefreshToken"
ADD CONSTRAINT "AuthRefreshToken_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
