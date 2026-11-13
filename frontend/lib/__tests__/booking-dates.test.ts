import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDays, buildDayStrip, formatDayShort, groupSlotsByPeriod } from "@/features/booking/dates";
import type { BookingSlot } from "@/features/booking/model";

const slot = (id: string, startTime: string): BookingSlot => ({ id, date: "2026-11-13", startTime, endTime: startTime });

describe("booking dates", () => {
  it("cộng ngày qua cuối tháng và cuối năm", () => {
    assert.equal(addDays("2026-11-30", 1), "2026-12-01");
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  });

  it("dải ngày bắt đầu từ hôm nay, đúng thứ và đánh dấu Chủ nhật", () => {
    const strip = buildDayStrip("2026-11-13", 4);
    assert.deepEqual(strip.map((d) => d.value), ["2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16"]);
    assert.deepEqual(strip.map((d) => d.weekday), ["T6", "T7", "CN", "T2"]);
    assert.equal(strip[0].isToday, true);
    assert.equal(strip[1].isToday, false);
    assert.equal(strip[2].isSunday, true);
    assert.equal(strip[0].day, "13");
    assert.equal(strip[0].month, "11");
  });

  it("chia khung giờ theo buổi và sắp xếp theo giờ", () => {
    const groups = groupSlotsByPeriod([slot("c", "13:30"), slot("a", "08:00"), slot("b", "11:30"), slot("d", "12:00")]);
    assert.deepEqual(groups.map((g) => g.key), ["morning", "afternoon"]);
    assert.deepEqual(groups[0].slots.map((s) => s.id), ["a", "b"]);
    assert.deepEqual(groups[1].slots.map((s) => s.id), ["d", "c"]);
  });

  it("bỏ nhóm rỗng", () => {
    assert.deepEqual(groupSlotsByPeriod([slot("a", "09:00")]).map((g) => g.key), ["morning"]);
    assert.deepEqual(groupSlotsByPeriod([]), []);
  });

  it("định dạng ngày ngắn kèm thứ", () => {
    assert.equal(formatDayShort("2026-11-13"), "T6 13/11/2026");
    assert.equal(formatDayShort(""), "");
    assert.equal(formatDayShort("13/11/2026"), "");
  });
});
