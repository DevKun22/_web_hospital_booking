import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createArticleSchema, updateArticleSchema } from "../../src/validations/article.validation.js";

const base = { title: "Ăn uống khi trời nắng nóng", content: "Nội dung bài viết đủ dài để hợp lệ." };
const assetId = "0b0d7c2e-6f3a-4a41-9a3e-1f2b3c4d5e6f";

describe("ảnh bìa bài viết", () => {
  it("tạo bài nhận mã ảnh hợp lệ hoặc không có ảnh, từ chối mã sai và null", () => {
    assert.equal(createArticleSchema.safeParse(base).success, true);
    assert.equal(createArticleSchema.safeParse({ ...base, imageAssetId: assetId }).success, true);
    assert.equal(createArticleSchema.safeParse({ ...base, imageAssetId: "abc" }).success, false);
    assert.equal(createArticleSchema.safeParse({ ...base, imageAssetId: null }).success, false);
  });

  it("cập nhật cho phép đổi ảnh, gỡ ảnh bằng null, hoặc không đụng tới ảnh", () => {
    assert.equal(updateArticleSchema.safeParse({ imageAssetId: assetId }).success, true);
    assert.equal(updateArticleSchema.safeParse({ imageAssetId: null }).success, true);
    assert.equal(updateArticleSchema.safeParse({ title: "Tiêu đề mới" }).success, true);
    assert.equal(updateArticleSchema.safeParse({ imageAssetId: "abc" }).success, false);
  });
});
