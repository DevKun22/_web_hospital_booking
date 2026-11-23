import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cancelDeadlineOf } from "../../src/utils/cancelDeadline.js";

describe("cancelDeadlineOf", () => {
  const item = { appointmentDate: new Date("2026-11-25T00:00:00.000Z"), startTime: "08:30" };

  it("trừ số giờ khóa hủy khỏi giờ bắt đầu theo múi giờ Việt Nam", () => {
    // 08:30 +07:00 = 01:30Z; trừ 2 giờ = 23:30Z ngày trước.
    assert.equal(cancelDeadlineOf(item, 2), "2026-11-24T23:30:00.000Z");
  });

  it("khóa hủy bằng 0 thì mốc là giờ bắt đầu", () => {
    assert.equal(cancelDeadlineOf(item, 0), "2026-11-25T01:30:00.000Z");
  });

  it("không nhận số giờ âm", () => {
    assert.equal(cancelDeadlineOf(item, -5), "2026-11-25T01:30:00.000Z");
  });
});
