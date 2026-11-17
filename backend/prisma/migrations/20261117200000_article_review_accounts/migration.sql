-- Người viết và người duyệt bài là tài khoản thật (không gõ tay tên người duyệt).
ALTER TABLE "Article" ADD COLUMN "authorId" TEXT;
ALTER TABLE "Article" ADD COLUMN "reviewedById" TEXT;

CREATE INDEX "Article_authorId_idx" ON "Article"("authorId");
CREATE INDEX "Article_reviewedById_idx" ON "Article"("reviewedById");

ALTER TABLE "Article" ADD CONSTRAINT "Article_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Article" ADD CONSTRAINT "Article_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Bài nháp đã soạn trước đây có người duyệt gõ tay (nếu có) không còn hợp lệ: bỏ dấu duyệt, bài chờ duyệt bằng tài khoản bác sĩ.
UPDATE "Article" SET "reviewerName" = NULL, "reviewedAt" = NULL WHERE "reviewedById" IS NULL AND "status" = 'DRAFT';
