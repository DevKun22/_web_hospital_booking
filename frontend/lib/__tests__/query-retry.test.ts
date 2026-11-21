import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldRetryQuery } from "../query-retry";

describe("thử lại truy vấn", () => {
  it("không thử lại lỗi 4xx", () => {
    assert.equal(shouldRetryQuery(0, { status: 401 }), false);
    assert.equal(shouldRetryQuery(0, { status: 404 }), false);
  });

  it("thử lại một lần với lỗi mạng hoặc 5xx", () => {
    assert.equal(shouldRetryQuery(0, new Error("network")), true);
    assert.equal(shouldRetryQuery(0, { status: 503 }), true);
    assert.equal(shouldRetryQuery(1, { status: 503 }), false);
  });
});
