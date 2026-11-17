import assert from "node:assert/strict";
import test from "node:test";

import { estimateReadingMinutes, getOutline, parseInline, parseMarkdown, slugifyHeading } from "../markdown";

test("neo theo tiêu đề mục giống backend: bỏ dấu, chữ thường, gạch ngang", () => {
  assert.equal(slugifyHeading("Khi nào cần đi khám?"), "khi-nao-can-di-kham");
  assert.equal(slugifyHeading("Đường huyết & ăn uống"), "duong-huyet-an-uong");
});

test("đọc khối: tiêu đề, đoạn nhiều dòng, danh sách có thứ tự và không thứ tự, trích dẫn", () => {
  const blocks = parseMarkdown(
    ["## Uống đủ nước", "Dòng một", "dòng hai", "", "- Một", "- Hai", "", "1. Bước đầu", "2. Bước sau", "", "> Lưu ý", "", "### Mục con"].join("\n"),
  );
  assert.deepEqual(blocks.map((block) => block.type), ["heading", "paragraph", "list", "list", "quote", "heading"]);
  const paragraph = blocks[1];
  assert.equal(paragraph.type === "paragraph" && paragraph.children[0].type === "text" ? paragraph.children[0].text : "", "Dòng một dòng hai");
  assert.equal(blocks[2].type === "list" && blocks[2].ordered, false);
  assert.equal(blocks[3].type === "list" && blocks[3].ordered, true);
  assert.equal(blocks[5].type === "heading" && blocks[5].level, 3);
});

test("mục lục lấy tiêu đề cấp 2 và neo trùng nhau được đánh số để không đè nhau", () => {
  const blocks = parseMarkdown("## Lời khuyên\n\ntext\n\n### Chi tiết\n\n## Lời khuyên\n\ntext");
  assert.deepEqual(getOutline(blocks), [
    { id: "loi-khuyen", text: "Lời khuyên" },
    { id: "loi-khuyen-2", text: "Lời khuyên" },
  ]);
});

test("in đậm, in nghiêng và liên kết an toàn; liên kết nguy hiểm chỉ còn chữ", () => {
  const nodes = parseInline("Uống **đủ nước**, *nghỉ ngơi* và xem [bài này](/kien-thuc/a) hoặc [lừa](javascript:alert(1))");
  assert.equal(nodes.some((node) => node.type === "bold"), true);
  assert.equal(nodes.some((node) => node.type === "italic"), true);
  const links = nodes.filter((node) => node.type === "link");
  assert.equal(links.length, 1);
  assert.equal(links[0].type === "link" && links[0].href, "/kien-thuc/a");
  assert.equal(nodes.some((node) => node.type === "text" && node.text === "lừa"), true);
});

test("thời gian đọc tối thiểu 1 phút", () => {
  assert.equal(estimateReadingMinutes("ngắn"), 1);
  assert.equal(estimateReadingMinutes(Array(450).fill("từ").join(" ")), 2);
});
