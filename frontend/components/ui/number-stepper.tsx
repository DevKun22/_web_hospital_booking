"use client";

import { Minus, Plus } from "lucide-react";
import { useId, useState } from "react";

type NumberStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  disabled?: boolean;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function NumberStepper({
  value,
  onChange,
  min = 1,
  max = 12,
  step = 1,
  label,
  disabled = false,
}: NumberStepperProps) {
  const helpId = useId();
  const [inputState, setInputState] = useState(() => ({
    sourceValue: value,
    draft: String(value),
  }));
  const draft =
    inputState.sourceValue === value ? inputState.draft : String(value);
  const setDraft = (next: string) =>
    setInputState({ sourceValue: value, draft: next });

  const commit = (nextValue: number | string) => {
    const parsed = typeof nextValue === "number" ? nextValue : Number(nextValue);
    const normalized = Number.isFinite(parsed)
      ? clamp(Math.round(parsed), min, max)
      : value;

    setDraft(String(normalized));
    if (normalized !== value) onChange(normalized);
  };

  return (
    <div>
      <div className="flex items-center overflow-hidden rounded-md border border-[#cfd8e6] bg-white shadow-sm focus-within:border-[#0d4f8b] focus-within:ring-2 focus-within:ring-[#0d4f8b]/15">
        <button
          type="button"
          onClick={() => commit(value - step)}
          disabled={disabled || value <= min}
          aria-label={`Giảm ${label.toLocaleLowerCase("vi-VN")}`}
          className="inline-flex min-h-11 min-w-11 items-center justify-center border-r border-[#dce3ee] text-[#42526b] transition-colors hover:bg-[#f3f7fc] hover:text-[#0d4f8b] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0d4f8b] disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:text-[#b4bfce]"
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>

        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={draft}
          disabled={disabled}
          aria-label={label}
          aria-describedby={helpId}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => {
            const numericValue = event.target.value.replace(/\D/g, "");
            setDraft(numericValue);
          }}
          onBlur={() => commit(draft)}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp") {
              event.preventDefault();
              commit(value + step);
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              commit(value - step);
            }
            if (event.key === "Enter") {
              event.preventDefault();
              commit(draft);
              event.currentTarget.blur();
            }
          }}
          className="min-h-11 min-w-0 flex-1 bg-transparent px-3 text-center text-base font-semibold tabular-nums text-[#172b4d] outline-none disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
        />

        <button
          type="button"
          onClick={() => commit(value + step)}
          disabled={disabled || value >= max}
          aria-label={`Tăng ${label.toLocaleLowerCase("vi-VN")}`}
          className="inline-flex min-h-11 min-w-11 items-center justify-center border-l border-[#dce3ee] text-[#42526b] transition-colors hover:bg-[#f3f7fc] hover:text-[#0d4f8b] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#0d4f8b] disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:text-[#b4bfce]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <p id={helpId} className="mt-1.5 text-xs text-[#667892]">
        Tối thiểu {min}, tối đa {max} mục. Có thể nhập trực tiếp hoặc dùng nút − / +.
      </p>
    </div>
  );
}
