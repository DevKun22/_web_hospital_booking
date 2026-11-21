import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { slugifyHeading } from "../markdown";
import { createSlug } from "../slug";

describe("đường dẫn không dấu", () => {
  it("bỏ dấu, đổi đ thành d, gộp ký tự lạ thành một gạch nối", () => {
    assert.equal(createSlug("Tim mạch"), "tim-mach");
    assert.equal(createSlug("Đường huyết & Đái tháo đường"), "duong-huyet-dai-thao-duong");
    assert.equal(createSlug("  Khám tổng quát  "), "kham-tong-quat");
    assert.equal(createSlug("***"), "");
  });

  it("neo tiêu đề bài viết dùng cùng thuật toán", () => {
    assert.equal(slugifyHeading("Công nghệ và thiết bị"), createSlug("Công nghệ và thiết bị"));
  });
});
