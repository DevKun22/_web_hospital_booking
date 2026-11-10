import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { can } from "@/lib/permissions";

describe("can", () => {
  it("từ chối khi chưa có người dùng hoặc chưa có danh sách quyền", () => {
    assert.equal(can(null, "appointment.view"), false);
    assert.equal(can(undefined, "appointment.view"), false);
    assert.equal(can({ permissions: undefined as unknown as string[] }, "appointment.view"), false);
  });

  it("cho phép khi có đúng quyền và từ chối khi thiếu", () => {
    const user = { permissions: ["appointment.view", "schedule.view"] };
    assert.equal(can(user, "appointment.view"), true);
    assert.equal(can(user, "invoice.view"), false);
  });

  it("nhiều mã quyền nghĩa là có BẤT KỲ mã nào", () => {
    const user = { permissions: ["schedule.lock"] };
    assert.equal(can(user, "schedule.manage", "schedule.lock"), true);
    assert.equal(can(user, "schedule.manage", "schedule.review"), false);
  });

  it("không có mã nào được hỏi thì không cho qua", () => {
    assert.equal(can({ permissions: ["appointment.view"] }), false);
  });
});
