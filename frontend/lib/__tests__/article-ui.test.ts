import assert from "node:assert/strict";
import test from "node:test";

import { ARTICLE_STAGE_LABEL, getArticleStage, shouldAutoSlug } from "../article-ui";

test("giai đoạn bài viết suy ra từ trạng thái và dấu duyệt", () => {
  assert.equal(getArticleStage({ status: "DRAFT", reviewedAt: null }), "PENDING_REVIEW");
  assert.equal(getArticleStage({ status: "DRAFT", reviewedAt: "2026-11-17T03:00:00.000Z" }), "READY");
  assert.equal(getArticleStage({ status: "PUBLISHED", reviewedAt: "2026-11-17T03:00:00.000Z" }), "PUBLISHED");
  assert.equal(ARTICLE_STAGE_LABEL.READY, "Đã duyệt, chờ xuất bản");
});

test("đường dẫn tự theo tiêu đề cho tới khi sửa tay hoặc bị khóa", () => {
  assert.equal(shouldAutoSlug({ slugTouched: false, locked: false }), true);
  assert.equal(shouldAutoSlug({ slugTouched: true, locked: false }), false);
  assert.equal(shouldAutoSlug({ slugTouched: false, locked: true }), false);
});
