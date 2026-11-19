import assert from "node:assert/strict";
import test from "node:test";
import { sectionAnchors } from "../section-anchors";

test("mục trống bị bỏ, neo bỏ dấu và trùng tiêu đề được thêm số thứ tự", () => {
  const anchors = sectionAnchors([
    { title: "Tổng quan", body: "Nội dung" },
    { title: "Trống", body: "   " },
    { title: "Thiết bị", body: "Máy siêu âm" },
    { title: "Tổng quan", body: "Mục thứ hai cùng tiêu đề" },
  ]);
  assert.deepEqual(anchors.map((item) => item.id), ["tong-quan", "thiet-bi", "tong-quan-2"]);
});

test("neo của mục đầu khớp cách backend dựng liên kết nguồn chatbot", () => {
  // Backend: createSlug("Công nghệ và thiết bị") ; cùng thuật toán với slugifyHeading.
  assert.equal(sectionAnchors([{ title: "Công nghệ và thiết bị", body: "x" }])[0].id, "cong-nghe-va-thiet-bi");
  assert.equal(sectionAnchors([{ title: "Đặt lịch", body: "x" }])[0].id, "dat-lich");
});

test("thiếu danh sách mục thì trả mảng rỗng", () => {
  assert.deepEqual(sectionAnchors(undefined), []);
});
