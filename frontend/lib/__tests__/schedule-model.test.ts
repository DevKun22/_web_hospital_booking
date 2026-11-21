import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDaysToInput,
  buildCreateSchedulePayload,
  buildUpdateSchedulePayload,
  impactText,
  viewTabs,
} from "../../app/dashboard/schedules/schedule-model";

const form = { doctorId: "d1", dayOfWeek: "2", startTime: "08:00", endTime: "11:30", slotDuration: "", isActive: true, facilityId: "" };

describe("lịch làm việc của bác sĩ", () => {
  it("cộng ngày theo ngày dương lịch, qua cuối tháng và năm nhuận", () => {
    assert.equal(addDaysToInput("2026-11-28", 3), "2026-12-01");
    assert.equal(addDaysToInput("2028-02-28", 1), "2028-02-29");
    assert.equal(addDaysToInput("2026-12-31", 1), "2027-01-01");
    assert.equal(addDaysToInput("2026-11-10", -10), "2026-10-31");
  });

  it("câu báo ảnh hưởng nêu đủ số khung giờ và số lịch đã đặt", () => {
    assert.equal(impactText(null), "");
    assert.equal(impactText({ generatedSlots: 0, removedSlots: 0, affected: [] }), "");
    const text = impactText({ generatedSlots: 4, removedSlots: 2, affected: [{ appointmentId: "a", bookingCode: "HB-1", patientName: "An", date: "2026-11-24", startTime: "08:30" }] });
    assert.match(text, /gỡ 2 khung giờ trống/);
    assert.match(text, /sinh 4 khung giờ mới/);
    assert.match(text, /1 lịch đã đặt/);
  });

  it("dữ liệu gửi đi: thời lượng mặc định 30 phút, cơ sở để trống thì không gửi", () => {
    const update = buildUpdateSchedulePayload(form);
    assert.equal(update.slotDuration, 30);
    assert.equal(update.dayOfWeek, 2);
    assert.equal(update.facilityId, undefined);
    assert.equal(buildUpdateSchedulePayload({ ...form, slotDuration: "45", facilityId: "f1" }).facilityId, "f1");
    assert.deepEqual(buildCreateSchedulePayload(form).doctorId, "d1");
  });

  it("tab yêu cầu đổi lịch chỉ hiện khi được phép và kèm số đang chờ", () => {
    assert.equal(viewTabs(false, 3).length, 2);
    const tabs = viewTabs(true, 3);
    assert.equal(tabs.length, 3);
    assert.equal(tabs[2].count, 3);
  });
});
