-- Ảnh bìa cho bài viết kiến thức: cột lưu đường dẫn ảnh và loại chủ sở hữu ảnh ARTICLE trong kho ảnh.
ALTER TYPE "MediaOwnerType" ADD VALUE IF NOT EXISTS 'ARTICLE';

ALTER TABLE "Article" ADD COLUMN "coverImage" TEXT;
