import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  formatVietnamDate,
  formatVietnamDateTime,
  fromVietnamDateTimeInput,
  getVietnamDateInput,
  isVietnamSlotStartInPast,
  toVietnamDateTimeInput,
} from "@/lib/date";

const RealDate = Date;
// Đặt đồng hồ giả: new Date() không đối số trả về đúng thời điểm này.
const freezeNow = (iso: string) => {
  const fixed = new RealDate(iso).getTime();
  class FakeDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(fixed);
      else super(...(args as [string | number | Date]));
    }
    static now() {
      return fixed;
    }
  }
  globalThis.Date = FakeDate as unknown as DateConstructor;
};
afterEach(() => {
  globalThis.Date = RealDate;
});

describe("định dạng ngày Việt Nam", () => {
  it("ngày thuần YYYY-MM-DD đổi thành dd/mm/yyyy, không lệch múi giờ", () => {
    assert.equal(formatVietnamDate("2026-11-13"), "13/11/2026");
    assert.equal(formatVietnamDate("2026-11-13T00:00:00.000Z"), "13/11/2026");
  });

  it("thời điểm ISO có giờ được hiển thị theo giờ Việt Nam (UTC+7)", () => {
    const text = formatVietnamDateTime("2026-11-13T01:30:00.000Z");
    assert.ok(text.includes("13/11/2026"), text);
    assert.ok(text.includes("08:30"), text);
  });

  it("giá trị rỗng hoặc không hợp lệ không làm hỏng giao diện", () => {
    assert.equal(formatVietnamDate(null), "");
    assert.equal(formatVietnamDate(""), "");
    assert.equal(formatVietnamDateTime(undefined), "");
    assert.equal(formatVietnamDateTime("không phải ngày"), "không phải ngày");
  });
});

describe("ô ngày giờ", () => {
  it("chuyển qua lại giữa ISO và giá trị YYYY-MM-DDTHH:mm theo giờ Việt Nam", () => {
    // 18:00 UTC ngày 12 là 01:00 ngày 13 ở Việt Nam.
    assert.equal(toVietnamDateTimeInput("2026-11-12T18:00:00.000Z"), "2026-11-13T01:00");
    assert.equal(fromVietnamDateTimeInput("2026-11-13T01:00"), "2026-11-12T18:00:00.000Z");
    const iso = "2026-12-31T16:59:00.000Z";
    assert.equal(fromVietnamDateTimeInput(toVietnamDateTimeInput(iso)), iso);
  });

  it("giá trị rỗng hoặc sai trả về rỗng hoặc null", () => {
    assert.equal(toVietnamDateTimeInput(null), "");
    assert.equal(toVietnamDateTimeInput("sai"), "");
    assert.equal(fromVietnamDateTimeInput(""), null);
    assert.equal(fromVietnamDateTimeInput("sai"), null);
  });

  it("ngày hôm nay lấy theo giờ Việt Nam", () => {
    assert.equal(getVietnamDateInput(new Date("2026-11-12T18:30:00.000Z")), "2026-11-13");
    assert.equal(getVietnamDateInput(new Date("2026-11-12T16:30:00.000Z")), "2026-11-12");
  });
});

describe("khung giờ đã qua", () => {
  it("so với giờ Việt Nam hiện tại", () => {
    freezeNow("2026-11-10T03:00:00.000Z"); // 10:00 ngày 10/11 ở Việt Nam
    assert.equal(isVietnamSlotStartInPast("2026-11-09", "15:00"), true);
    assert.equal(isVietnamSlotStartInPast("2026-11-10", "09:30"), true);
    assert.equal(isVietnamSlotStartInPast("2026-11-10", "10:00"), true);
    assert.equal(isVietnamSlotStartInPast("2026-11-10", "10:30"), false);
    assert.equal(isVietnamSlotStartInPast("2026-11-11", "08:00"), false);
  });
});
