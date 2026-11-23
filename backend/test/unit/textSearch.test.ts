import assert from "node:assert/strict";
import test from "node:test";
import { createFoldedMatcher } from "../../src/utils/textSearch.js";

test("tìm không dấu khớp tên có dấu", () => {
  const matches = createFoldedMatcher("tim mach");
  assert.ok(matches);
  assert.equal(matches(["Khoa Tim mạch"]), true);
  assert.equal(matches(["Khoa Nhi"]), false);
});

test("mỗi từ chỉ cần xuất hiện ở một trường bất kỳ", () => {
  const matches = createFoldedMatcher("Đau  ngực");
  assert.ok(matches);
  assert.equal(matches(["Tim mạch", null, "đau ngực, khó thở"]), true);
  assert.equal(matches(["Tim mạch", "đau đầu"]), false);
});

test("câu tìm rỗng thì không lọc", () => {
  assert.equal(createFoldedMatcher("   "), null);
  assert.equal(createFoldedMatcher(undefined), null);
});
