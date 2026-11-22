import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPatientInfoForm, buildPatientInfoPayload, canEditPatientInfoStatus, toDateInputValue } from "../../app/dashboard/appointments/appointment-model";
import { buildLabPayload, buildRecordPayload } from "../../app/dashboard/medical-records/record-model";
import { buildItemPayload, getIncludedItemsTotal } from "../../app/dashboard/packages/package-model";
import type { Appointment, PackageItem } from "../types";

describe("lịch hẹn: thông tin người khám", () => {
  it("chuẩn hóa ngày sinh và giá trị thiếu thành chuỗi rỗng", () => {
    assert.equal(toDateInputValue("1990-03-12T00:00:00.000Z"), "1990-03-12");
    assert.equal(toDateInputValue(null), "");
    const form = buildPatientInfoForm({ patientName: "An", hasBHYT: false } as Appointment);
    assert.equal(form.patientName, "An");
    assert.equal(form.gender, "");
    assert.equal(form.cccd, "");
    assert.equal(form.hasBHYT, false);
  });

  it("dữ liệu gửi đi: chuỗi trống thành null, không có BHYT thì bỏ mã thẻ và nơi đăng ký", () => {
    const base = { ...buildPatientInfoForm({ patientName: " An ", hasBHYT: false } as Appointment), healthInsuranceCode: "DN123", registeredHospital: "BV A", allergies: "  " };
    const withoutBhyt = buildPatientInfoPayload(base);
    assert.equal(withoutBhyt.patientName, "An");
    assert.equal(withoutBhyt.healthInsuranceCode, null);
    assert.equal(withoutBhyt.registeredHospital, null);
    assert.equal(withoutBhyt.allergies, null);
    assert.equal(withoutBhyt.gender, null);
    const withBhyt = buildPatientInfoPayload({ ...base, hasBHYT: true });
    assert.equal(withBhyt.healthInsuranceCode, "DN123");
    assert.equal(withBhyt.registeredHospital, "BV A");
  });

  it("chỉ sửa được thông tin khi lịch còn hiệu lực", () => {
    assert.equal(canEditPatientInfoStatus("CONFIRMED"), true);
    assert.equal(canEditPatientInfoStatus("COMPLETED"), true);
    assert.equal(canEditPatientInfoStatus("PENDING_OTP"), false);
    assert.equal(canEditPatientInfoStatus("CANCELLED_BY_ADMIN"), false);
    assert.equal(canEditPatientInfoStatus("NO_SHOW"), false);
  });
});

describe("hồ sơ khám: dữ liệu gửi đi", () => {
  it("chuỗi trống hoặc chỉ khoảng trắng thành null, còn lại được cắt khoảng trắng", () => {
    const record = buildRecordPayload({ symptoms: "  ho  ", diagnosis: "   ", treatment: "", doctorNotes: "ghi chú", resultPdfUrl: "" });
    assert.deepEqual(record, { symptoms: "ho", diagnosis: null, treatment: null, doctorNotes: "ghi chú", resultPdfUrl: null });
    const lab = buildLabPayload({ testName: " Công thức máu ", resultValue: "7,2", unit: "", referenceRange: " ", conclusion: "", fileUrl: "" });
    assert.equal(lab.testName, "Công thức máu");
    assert.equal(lab.resultValue, "7,2");
    assert.equal(lab.unit, null);
    assert.equal(lab.referenceRange, null);
  });
});

describe("gói khám: hạng mục", () => {
  it("tổng giá chỉ cộng hạng mục đã bao gồm", () => {
    const items = [{ included: true, price: 100000 }, { included: false, price: 500000 }, { included: true, price: 50000 }] as PackageItem[];
    assert.equal(getIncludedItemsTotal(items), 150000);
    assert.equal(getIncludedItemsTotal([]), 0);
  });

  it("dữ liệu hạng mục: giá và thứ tự mặc định 0, tên được cắt khoảng trắng", () => {
    const payload = buildItemPayload({ name: "  Xét nghiệm máu ", description: "", price: "", included: true, order: "" });
    assert.deepEqual(payload, { name: "Xét nghiệm máu", description: null, price: 0, included: true, order: 0 });
  });
});
