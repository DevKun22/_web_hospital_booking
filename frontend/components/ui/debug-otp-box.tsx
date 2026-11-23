"use client";

type DebugOtpBoxProps = {
  otp?: string;
  onFill: (otp: string) => void;
  className?: string;
};

export function DebugOtpBox({ otp, onFill, className = "" }: DebugOtpBoxProps) {
  if (!otp) return null;

  return (
    <div className={`rounded-md border border-[var(--status-warning)] bg-[var(--status-warning-soft)] px-3 py-2.5 text-sm text-[var(--status-warning)] ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide">Mã OTP Test</p>
          <p className="mt-1 text-xl font-semibold tracking-[0.18em]">{otp}</p>
        </div>
        <button
          type="button"
          onClick={() => onFill(otp)}
          className="shrink-0 rounded-md border border-[var(--status-warning)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--status-warning)] hover:bg-[var(--status-warning-soft)]"
        >
          Điền mã
        </button>
      </div>
      <p className="mt-2 text-xs leading-5">Chỉ hiển thị để phục vụ kiểm thử đồ án.</p>
    </div>
  );
}
