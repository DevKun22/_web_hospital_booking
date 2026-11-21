import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scrollProgress } from "../scroll-progress";

describe("tiến độ cuộn", () => {
  it("0 trước vùng, 1 sau vùng, giữa vùng theo tỉ lệ", () => {
    assert.equal(scrollProgress(0, 500, 3000, 800), 0);
    assert.equal(scrollProgress(500, 500, 3000, 800), 0);
    assert.equal(scrollProgress(1600, 500, 3000, 800), 0.5);
    assert.equal(scrollProgress(9999, 500, 3000, 800), 1);
  });

  it("vùng ngắn hơn màn hình thì không có tiến độ", () => {
    assert.equal(scrollProgress(100, 0, 600, 800), 0);
    assert.equal(scrollProgress(100, 0, NaN, 800), 0);
  });
});
