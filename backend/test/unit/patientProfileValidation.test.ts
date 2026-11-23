import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { patientProfileUpdateSchema } from "../../src/validations/patientV1.validation.js";

describe("patient profile validation: số điện thoại liên hệ", () => {
  it("nhận số điện thoại hợp lệ và cắt khoảng trắng", () => {
    const result = patientProfileUpdateSchema.safeParse({ phone: " 0987654321 " });
    assert.equal(result.success, true);
    assert.equal(result.success && result.data.phone, "0987654321");
  });

  it("nhận đầu số +84", () => {
    assert.equal(patientProfileUpdateSchema.safeParse({ phone: "+84987654321" }).success, true);
  });

  it("cho phép null để xóa số", () => {
    assert.equal(patientProfileUpdateSchema.safeParse({ phone: null }).success, true);
  });

  it("từ chối số sai định dạng", () => {
    assert.equal(patientProfileUpdateSchema.safeParse({ phone: "12345" }).success, false);
    assert.equal(patientProfileUpdateSchema.safeParse({ phone: "abc0987654" }).success, false);
  });

  it("vẫn yêu cầu ít nhất một trường và không nhận email", () => {
    assert.equal(patientProfileUpdateSchema.safeParse({}).success, false);
    const parsed = patientProfileUpdateSchema.safeParse({ email: "x@y.vn", fullName: "An" });
    assert.equal(parsed.success, true);
    assert.equal(parsed.success && "email" in parsed.data, false);
  });
});
