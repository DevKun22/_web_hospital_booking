"use client";

import { useState } from "react";
import { VietnamDateInput } from "@/components/ui/vietnam-date-input";

type VietnamDateTimeInputProps = {
  /** Dạng `YYYY-MM-DDTHH:mm` giống ô datetime-local, hoặc chuỗi rỗng khi chưa đủ ngày và giờ. */
  value: string;
  onChange: (value: string) => void;
  className?: string;
  min?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
};

// Ô nhập ngày giờ theo kiểu Việt Nam: ngày dd/mm/yyyy và giờ 24 giờ hh:mm (ô datetime-local gốc hiển thị theo ngôn ngữ
// trình duyệt, có thể là mm/dd/yyyy và AM/PM). Chỉ phát giá trị khi đã đủ cả ngày lẫn giờ hợp lệ.
const maskTime = (raw: string) => {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  return digits.slice(0, 2) + (digits.length > 2 ? `:${digits.slice(2)}` : "");
};

const validTime = (text: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(text);
  return Boolean(match) && Number(match![1]) < 24 && Number(match![2]) < 60;
};

const splitValue = (value: string) => {
  const [date = "", time = ""] = value.split("T");
  return { date, time: time.slice(0, 5) };
};

export function VietnamDateTimeInput({ value, onChange, className = "", min, required, disabled, ariaLabel }: VietnamDateTimeInputProps) {
  const initial = splitValue(value);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [lastValue, setLastValue] = useState(value);

  // Giá trị được đặt lại từ bên ngoài (ví dụ xóa form sau khi gửi): đồng bộ lại hai ô thành phần.
  if (value !== lastValue) {
    const next = splitValue(value);
    setLastValue(value);
    if (value !== `${date}T${time}`) {
      setDate(next.date);
      setTime(next.time);
    }
  }

  const emit = (nextDate: string, nextTime: string) => {
    const combined = nextDate && validTime(nextTime) ? `${nextDate}T${nextTime}` : "";
    setLastValue(combined);
    onChange(combined);
  };

  const timeInvalid = time.length === 5 && !validTime(time);

  return (
    <span style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", maxWidth: "100%" }}>
      <VietnamDateInput
        value={date}
        min={min}
        required={required}
        disabled={disabled}
        ariaLabel={ariaLabel ? `${ariaLabel} (ngày)` : "Ngày"}
        className={className}
        onChange={(next) => {
          setDate(next);
          emit(next, time);
        }}
      />
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="hh:mm"
        maxLength={5}
        value={time}
        required={required}
        disabled={disabled}
        aria-label={ariaLabel ? `${ariaLabel} (giờ, 24 giờ)` : "Giờ"}
        aria-invalid={timeInvalid || undefined}
        title={timeInvalid ? "Giờ không hợp lệ" : undefined}
        className={className}
        style={{ width: 84, ...(timeInvalid ? { borderColor: "#b3261e", boxShadow: "0 0 0 1px #b3261e" } : {}) }}
        onChange={(event) => {
          const next = maskTime(event.target.value);
          setTime(next);
          emit(date, next);
        }}
      />
    </span>
  );
}
