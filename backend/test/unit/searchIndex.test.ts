import assert from "node:assert/strict";
import test from "node:test";

import { buildSearchIndex, querySearchIndex, type SearchDocumentInput } from "../../src/services/search/search.index.js";

const doc = (
  type: "department" | "doctor" | "package" | "faq",
  id: string,
  title: string,
  extra: Partial<SearchDocumentInput> = {},
): SearchDocumentInput => ({
  result: { id, type, title, url: "/" + type + "/" + id, source: "postgres" },
  title,
  ...extra,
});

const index = buildSearchIndex([
  doc("department", "d1", "Tim mạch", { keywords: ["tim-mach", "đau ngực"], body: ["Khám bệnh lý tim và mạch máu"] }),
  doc("department", "d2", "Nhi khoa", { body: ["Khám cho trẻ em"] }),
  doc("doctor", "b1", "BS.CKII Nguyễn Minh Hùng", { keywords: ["Tim mạch"], body: ["Hơn 20 năm kinh nghiệm"] }),
  doc("package", "p1", "Gói khám tim mạch nâng cao", { keywords: ["Điện tâm đồ"], scoreBonus: 5 }),
  doc("faq", "f1", "Làm sao để hủy lịch hẹn?", { keywords: ["hủy lịch"], body: ["Vào mục lịch hẹn và chọn hủy"] }),
]);

const ids = (q: string, type: "all" | "department" | "doctor" | "package" | "faq" = "all", limit = 10) =>
  querySearchIndex(index, q, { type, limit }).map((item) => item.id);

test("accent-insensitive: unaccented input matches Vietnamese text and vice versa", () => {
  assert.deepEqual(ids("tim mach", "department"), ["d1"]);
  assert.deepEqual(ids("Tim Mạch", "department"), ["d1"]);
  assert.ok(ids("dau nguc").includes("d1"));
  assert.ok(ids("nguyen minh hung").includes("b1"));
  assert.ok(ids("dien tam do").includes("p1"));
  assert.ok(ids("huy lich").includes("f1"));
});

test("every query word must appear, so unrelated documents are not returned", () => {
  assert.deepEqual(ids("tim mach nhi khoa"), []);
  assert.deepEqual(ids("khong co gi"), []);
});

test("title matches rank above body-only matches and the type filter and limit apply", () => {
  const all = ids("tim mach");
  assert.equal(all[0], "d1");
  assert.ok(all.includes("b1") && all.includes("p1"));
  assert.deepEqual(ids("tim mach", "doctor"), ["b1"]);
  assert.equal(ids("tim mach", "all", 2).length, 2);
});

test("an empty or whitespace query returns nothing", () => {
  assert.deepEqual(ids("   "), []);
});
