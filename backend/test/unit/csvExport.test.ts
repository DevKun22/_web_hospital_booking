import assert from "node:assert/strict";
import test from "node:test";
import {
  EXPORT_MAX_ROWS,
  assertWithinRowLimit,
  buildCsv,
  csvCell,
  parseExportRange,
} from "../../src/utils/csvExport.js";

test("cells are quoted when needed and formulas are neutralised", () => {
  assert.equal(csvCell("đơn giản"), "đơn giản");
  assert.equal(csvCell('có "ngoặc", dấu phẩy'), '"có ""ngoặc"", dấu phẩy"');
  assert.equal(csvCell("hai\ndòng"), '"hai\ndòng"');
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(undefined), "");
  assert.equal(csvCell(true), "Có");
  assert.equal(csvCell(false), "Không");

  // Chuỗi bắt đầu bằng ký tự công thức được chặn; số thật (kể cả số âm) giữ nguyên.
  for (const formula of ['=HYPERLINK("http://x")', "+1+1", "-2+3", "@SUM(A1)", "\tcmd"]) {
    assert.ok(csvCell(formula).replace(/^"/, "").startsWith("'"), formula);
  }
  assert.equal(csvCell(-1200), "-1200");
  assert.equal(csvCell(Number.NaN), "");
});

test("dates are written in Vietnam time and the file opens cleanly in Excel", () => {
  assert.equal(csvCell(new Date("2026-11-08T17:30:05Z")), "2026-11-09 00:30:05");
  const csv = buildCsv(["Cột A", "Cột B"], [["x", 1], ["y", 2]]);
  assert.ok(csv.startsWith("﻿Cột A,Cột B\r\n"));
  assert.ok(csv.endsWith("y,2\r\n"));
});

test("export ranges default to 30 days, include the last day and reject bad input", () => {
  const now = new Date("2026-11-08T05:00:00Z"); // 12:00 giờ Việt Nam
  const range = parseExportRange({}, now);
  assert.equal(range.toText, "2026-11-08");
  assert.equal(range.fromText, "2026-10-10");
  // Ngày cuối được tính trọn ngày theo giờ Việt Nam.
  assert.equal(range.to.toISOString(), "2026-11-08T16:59:59.999Z");
  assert.equal(range.from.toISOString(), "2026-10-09T17:00:00.000Z");

  const explicit = parseExportRange({ from: "2026-01-01", to: "2026-01-31" }, now);
  assert.equal(explicit.fromText, "2026-01-01");

  assert.throws(() => parseExportRange({ from: "01/01/2026" }, now), /YYYY-MM-DD/);
  assert.throws(() => parseExportRange({ from: "2026-02-31x" }, now), /YYYY-MM-DD/);
  assert.throws(() => parseExportRange({ from: "2026-05-01", to: "2026-04-01" }, now), /trước hoặc bằng/);
  assert.throws(() => parseExportRange({ from: "2024-01-01", to: "2026-01-01" }, now), /tối đa/);
});

test("a report over the row limit is refused instead of silently truncated", () => {
  assert.doesNotThrow(() => assertWithinRowLimit(EXPORT_MAX_ROWS));
  assert.throws(
    () => assertWithinRowLimit(EXPORT_MAX_ROWS + 1),
    (error: { statusCode?: number; code?: string }) =>
      error.statusCode === 413 && error.code === "EXPORT_TOO_LARGE",
  );
});
