import assert from "node:assert/strict";
import test from "node:test";

import { fallbackSummary } from "../../src/services/chatbot/flows/article-summary.flow.js";
import { numbersAreFromArticle, summarizeArticleText } from "../../src/services/chatbot/rag/generator.js";

const article = {
  title: "Tăng huyết áp: những điều cần biết",
  summary: null,
  content: [
    "## Tăng huyết áp là gì",
    "",
    "Tăng huyết áp là tình trạng áp lực máu lên thành động mạch cao hơn bình thường, thường kéo dài nhiều năm mà không có triệu chứng rõ.",
    "",
    "## Khi nào cần đi khám",
    "",
    "Bạn nên đi khám khi huyết áp đo tại nhà thường xuyên từ 140/90 trở lên.",
  ].join("\n"),
};

test("bản tóm tắt không cần AI lấy đoạn mô tả và các mục của chính bài", () => {
  const summary = fallbackSummary(article);
  assert.match(summary, /^• Tăng huyết áp là tình trạng/);
  assert.match(summary, /Bài gồm các mục: Tăng huyết áp là gì, Khi nào cần đi khám\./);

  const withSummary = fallbackSummary({ ...article, summary: "Hiểu đúng về huyết áp cao." });
  assert.match(withSummary, /^• Hiểu đúng về huyết áp cao\./);

  assert.match(fallbackSummary({ title: "Bài rỗng", summary: null, content: "" }), /chưa có đủ nội dung/);
});

test("con số trong bản tóm tắt phải có trong bài: số tự thêm bị loại", () => {
  assert.equal(numbersAreFromArticle("• Đi khám khi huyết áp từ 140/90 trở lên.", article.content), true);
  assert.equal(numbersAreFromArticle("• Nên uống 500 mg mỗi ngày.", article.content), false);
  assert.equal(numbersAreFromArticle("• Không có số liệu nào, chỉ có 1 ý.", article.content), true);
});

test("AI tóm tắt: nhận bản hợp lệ, bỏ bản thêm số liệu hoặc sai định dạng, và truyền lỗi gọi AI lên", async () => {
  const good = "• Tăng huyết áp thường kéo dài nhiều năm mà không rõ triệu chứng.\n• Nên đi khám khi huyết áp từ 140/90 trở lên.";
  assert.equal(await summarizeArticleText({ ...article, generate: async () => JSON.stringify({ summary: good }) }), good);

  const invented = "• Nên uống thuốc 500 mg mỗi ngày để kiểm soát huyết áp lâu dài hiệu quả.";
  assert.equal(await summarizeArticleText({ ...article, generate: async () => JSON.stringify({ summary: invented }) }), null);
  assert.equal(await summarizeArticleText({ ...article, generate: async () => "không phải JSON" }), null);
  assert.equal(await summarizeArticleText({ ...article, generate: async () => JSON.stringify({ summary: "ngắn" }) }), null);

  await assert.rejects(
    summarizeArticleText({
      ...article,
      generate: async () => {
        throw new Error("hết hạn mức");
      },
    }),
    /hết hạn mức/,
  );
});
