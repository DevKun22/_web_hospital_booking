"use client";

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

export function VietnamDateInput({
  value,
  onChange,
  className = "",
  min,
  max,
  required,
  disabled,
  ariaLabel,
}: VietnamDateInputProps) {
  return (
    <input
      type="date"
      lang="vi-VN"
      value={value}
      min={min}
      max={max}
      required={required}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
      className={className}
    />
  );
}
