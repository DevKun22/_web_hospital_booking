import assert from "node:assert/strict";
import test from "node:test";
import { summarizeAvailableDates } from "../../src/utils/availableDates.js";

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

test("gom khung giờ theo ngày và xếp tăng dần", () => {
  const result = summarizeAvailableDates(
    [
      { date: day("2026-11-24"), startTime: "08:00" },
      { date: day("2026-11-23"), startTime: "08:00" },
      { date: day("2026-11-23"), startTime: "08:30" },
    ],
    () => false,
  );
  assert.deepEqual(result, [
    { date: "2026-11-23", count: 2 },
    { date: "2026-11-24", count: 1 },
  ]);
});

test("bỏ khung đã qua giờ bắt đầu và ngày không còn khung nào", () => {
  const result = summarizeAvailableDates(
    [
      { date: day("2026-11-21"), startTime: "07:00" },
      { date: day("2026-11-22"), startTime: "09:00" },
    ],
    (date) => date.toISOString().startsWith("2026-11-21"),
  );
  assert.deepEqual(result, [{ date: "2026-11-22", count: 1 }]);
});

test("không có khung giờ thì trả danh sách rỗng", () => {
  assert.deepEqual(summarizeAvailableDates([], () => false), []);
});
