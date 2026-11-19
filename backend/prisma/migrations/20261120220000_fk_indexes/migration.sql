-- Khóa ngoại tới người dùng chưa có chỉ mục (Supabase advisor 0001): thêm để xóa hoặc đổi người dùng không quét cả bảng.
CREATE INDEX "Article_authorId_idx" ON "Article"("authorId");
CREATE INDEX "Article_reviewedById_idx" ON "Article"("reviewedById");
CREATE INDEX "ScheduleChangeRequest_reviewedById_idx" ON "ScheduleChangeRequest"("reviewedById");
