import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createPackageSchema,
  updatePackageSchema,
} from "../../src/validations/package.validation.js";

describe("package validation: ảnh gói khám", () => {
  const base = { name: "Gói tim mạch", basePrice: 500000 };

  it("cho phép tạo gói không có ảnh", () => {
    assert.equal(createPackageSchema.safeParse(base).success, true);
  });

  it("nhận đường dẫn ảnh hợp lệ và mã ảnh đã tải lên", () => {
    const result = createPackageSchema.safeParse({
      ...base,
      image: "https://example.com/goi.jpg",
      imageAssetId: "0b0d7c2e-6f3a-4a41-9a3e-1f2b3c4d5e6f",
    });
    assert.equal(result.success, true);
  });

  it("từ chối đường dẫn ảnh không phải URL", () => {
    assert.equal(createPackageSchema.safeParse({ ...base, image: "khong-phai-url" }).success, false);
  });

  it("cập nhật cho phép gỡ ảnh bằng imageAssetId null", () => {
    assert.equal(updatePackageSchema.safeParse({ imageAssetId: null, image: null }).success, true);
  });
});
