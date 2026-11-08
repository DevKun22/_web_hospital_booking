// Đọc CSV (RFC 4180) cho chức năng nhập tệp: có ngoặc kép, dấu phẩy/xuống dòng trong ô, BOM,
// CRLF hoặc LF. Excel tiếng Việt hay lưu bằng dấu chấm phẩy nên tự nhận dấu phân cách từ dòng đầu.

export type ParsedCsv = { headers: string[]; rows: { line: number; cells: string[] }[] };

const detectDelimiter = (text: string) => {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
};

export const parseCsv = (input: string): ParsedCsv => {
  const text = input.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const records: { line: number; cells: string[] }[] = [];

  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let recordLine = 1;
  let touched = false; // ô hiện tại có nội dung hoặc đã gặp dấu phân cách

  const endCell = () => {
    cells.push(cell);
    cell = "";
  };
  const endRecord = () => {
    endCell();
    if (cells.some((value) => value.trim() !== "")) records.push({ line: recordLine, cells });
    cells = [];
    touched = false;
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        if (char === "\n") line += 1;
        cell += char;
      }
      continue;
    }
    if (char === '"' && cell === "") {
      quoted = true;
      touched = true;
    } else if (char === delimiter) {
      endCell();
      touched = true;
    } else if (char === "\r") {
      if (text[index + 1] === "\n") index += 1;
      endRecord();
      line += 1;
      recordLine = line;
    } else if (char === "\n") {
      endRecord();
      line += 1;
      recordLine = line;
    } else {
      cell += char;
      touched = true;
    }
  }
  if (quoted) throw new Error("Tệp CSV có dấu ngoặc kép chưa đóng");
  if (touched || cell !== "") endRecord();

  const [head, ...body] = records;
  return {
    headers: (head?.cells ?? []).map((value) => value.trim()),
    rows: body,
  };
};
