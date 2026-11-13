import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatCurrency,
  formatMoney,
  formatOptionalCurrency,
  formatShortDate,
  formatShortDateTime,
} from "@/lib/format";
import {
  appointmentStatusDisplay,
  ACTIVE_APPOINTMENT_STATUSES,
  CANCELLABLE_APPOINTMENT_STATUSES,
  CANCELLED_APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS,
  APPOINTMENT_STATUS_DETAIL,
  invoiceStatusDisplay,
} from "@/lib/patient-status";

const normalize = (value: string) => value.replace(/\s/g, " ");

describe("format", () => {
  it("định dạng tiền Việt Nam", () => {
    assert.equal(normalize(formatCurrency(1250000)), "1.250.000 ₫");
    assert.equal(normalize(formatCurrency(null)), "0 ₫");
    assert.equal(normalize(formatMoney(1250000)), "1.250.000 đ");
    assert.equal(formatOptionalCurrency(0), "");
    assert.equal(formatOptionalCurrency(undefined), "");
  });

  it("hiển thị ngày theo giờ Việt Nam, kể cả khi múi giờ trình duyệt khác", () => {
    // 17:30 UTC ngày 12 đã là 00:30 ngày 13 ở Việt Nam.
    assert.equal(formatShortDate("2026-11-12T17:30:00.000Z"), "13/11/2026");
    assert.equal(normalize(formatShortDateTime("2026-11-12T17:30:00.000Z")), "00:30 13/11/26");
  });

  it("trả giá trị dự phòng khi thiếu hoặc sai ngày", () => {
    assert.equal(formatShortDate(null), "Chưa cập nhật");
    assert.equal(formatShortDate("không phải ngày"), "Chưa cập nhật");
    assert.equal(formatShortDate(undefined, "—"), "—");
    assert.equal(formatShortDateTime(null), "Chưa xác định");
  });
});

describe("patient-status", () => {
  it("mọi trạng thái đều có nhãn chi tiết và nhãn ngắn", () => {
    assert.deepEqual(Object.keys(APPOINTMENT_STATUS_DETAIL).sort(), Object.keys(APPOINTMENT_STATUS).sort());
  });

  it("các nhóm trạng thái không giao nhau và đều là trạng thái đã biết", () => {
    for (const status of [...ACTIVE_APPOINTMENT_STATUSES, ...CANCELLED_APPOINTMENT_STATUSES]) {
      assert.ok(status in APPOINTMENT_STATUS, status);
    }
    for (const status of ACTIVE_APPOINTMENT_STATUSES) assert.ok(!CANCELLED_APPOINTMENT_STATUSES.has(status));
    for (const status of CANCELLABLE_APPOINTMENT_STATUSES) assert.ok(ACTIVE_APPOINTMENT_STATUSES.has(status));
  });

  it("trạng thái lạ rơi về nhãn trung tính thay vì lỗi", () => {
    assert.equal(appointmentStatusDisplay("MOI_LA").label, "MOI_LA");
    assert.equal(invoiceStatusDisplay("UNPAID").label, "Chờ thanh toán");
    assert.equal(invoiceStatusDisplay("LA").label, "LA");
  });
});
