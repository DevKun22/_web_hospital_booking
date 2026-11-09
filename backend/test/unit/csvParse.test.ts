import assert from "node:assert/strict";
import test from "node:test";
import { parseCsv } from "../../src/utils/csvParse.js";

test("quoted cells, embedded commas and newlines, BOM and CRLF are read correctly", () => {
  const parsed = parseCsv('\uFEFFMã thuốc,Tên thuốc,Ghi chú\r\nPARA,"Paracetamol, 500mg","Dòng 1\nDòng 2"\r\nIBU,"Ibu ""fort""",\r\n');
  assert.deepEqual(parsed.headers, ["Mã thuốc", "Tên thuốc", "Ghi chú"]);
  assert.deepEqual(parsed.rows.map((row) => row.cells), [
    ["PARA", "Paracetamol, 500mg", "Dòng 1\nDòng 2"],
    ["IBU", 'Ibu "fort"', ""],
  ]);
  // Số dòng gắn với dòng gốc trong tệp để báo lỗi đúng chỗ (dòng 1 là tiêu đề).
  assert.deepEqual(parsed.rows.map((row) => row.line), [2, 4]);
});

test("semicolon files saved by Excel are detected and blank lines are skipped", () => {
  const parsed = parseCsv("Mã thuốc;Số lượng\n\nPARA;10\n;\nIBU;5");
  assert.deepEqual(parsed.headers, ["Mã thuốc", "Số lượng"]);
  assert.deepEqual(parsed.rows.map((row) => row.cells), [["PARA", "10"], ["IBU", "5"]]);
});

test("an unclosed quote is rejected instead of swallowing the rest of the file", () => {
  assert.throws(() => parseCsv('a,b\n"x,1\n'), /ngoặc kép/);
});
