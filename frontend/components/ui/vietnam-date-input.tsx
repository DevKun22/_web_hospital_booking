"use client";

import { ClipboardEvent, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";

type VietnamDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
};

// Giá trị ra vào luôn là chuỗi ISO yyyy-mm-dd; người dùng thấy và gõ theo dạng ngày/tháng/năm (dd/mm/yyyy).
// Ô ngày gốc của trình duyệt hiển thị theo ngôn ngữ của trình duyệt chứ không theo trang nên không dùng
// làm ô nhập chính; nó chỉ được dùng để mở lịch chọn ngày.
const isoToDisplay = (iso: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
};

const maskDigits = (raw: string) => {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  return digits.slice(0, 2) + (digits.length > 2 ? `/${digits.slice(2, 4)}` : "") + (digits.length > 4 ? `/${digits.slice(4)}` : "");
};

// Dán "9/11/2026" hoặc "09-11-2026" cũng được hiểu đúng; ngày không có thật (31/02) trả về rỗng.
const displayToIso = (display: string) => {
  const match = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(display.trim());
  if (!match) return "";
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return "";
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

export function VietnamDateInput({ value, onChange, className = "", min, max, required, disabled, ariaLabel }: VietnamDateInputProps) {
  // Khi đang gõ, giữ đúng chữ người dùng đã gõ; ngoài lúc gõ thì luôn hiển thị theo giá trị hiện có.
  const [draft, setDraft] = useState<string | null>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const shown = draft ?? isoToDisplay(value);
  const fullWidth = /(^|\s)(w-full|ds-input)(\s|$)/.test(className);

  const outOfRange = (iso: string) => Boolean((min && iso < min) || (max && iso > max));
  const complete = shown.length === 10;
  const invalid = draft !== null && complete && (!displayToIso(shown) || outOfRange(displayToIso(shown)));

  const commit = (text: string) => {
    setDraft(text);
    if (text === "") {
      onChange("");
      return;
    }
    const iso = displayToIso(text);
    if (iso && !outOfRange(iso)) onChange(iso);
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const iso = displayToIso(event.clipboardData.getData("text"));
    if (!iso) return;
    event.preventDefault();
    commit(isoToDisplay(iso));
  };

  const openPicker = () => {
    const picker = pickerRef.current;
    if (!picker || disabled) return;
    if (typeof picker.showPicker === "function") picker.showPicker();
    else picker.click();
  };

  return (
    <span style={{ position: "relative", display: fullWidth ? "block" : "inline-block", maxWidth: "100%" }}>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/yyyy"
        maxLength={10}
        value={shown}
        required={required}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        title={invalid ? "Ngày không hợp lệ hoặc nằm ngoài khoảng cho phép" : undefined}
        onChange={(event) => commit(maskDigits(event.target.value))}
        onPaste={handlePaste}
        onBlur={() => setDraft(null)}
        className={className}
        style={{ paddingRight: 34, width: fullWidth ? "100%" : undefined, minWidth: 120 }}
      />
      <button
        type="button"
        onClick={openPicker}
        disabled={disabled}
        aria-label={ariaLabel ? `Chọn ${ariaLabel.toLowerCase()} từ lịch` : "Chọn ngày từ lịch"}
        style={{
          position: "absolute",
          right: 6,
          top: "50%",
          transform: "translateY(-50%)",
          display: "inline-flex",
          padding: 4,
          border: 0,
          background: "transparent",
          color: "inherit",
          opacity: 0.6,
          cursor: disabled ? "default" : "pointer",
        }}
      >
        <CalendarDays size={16} aria-hidden="true" />
      </button>
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(event) => {
          setDraft(null);
          onChange(event.target.value);
        }}
        style={{ position: "absolute", right: 0, bottom: 0, width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
      />
    </span>
  );
}
