"use client";

import Link from "next/link";
import { useLegal } from "@/lib/legal";

// Ô đồng ý điều khoản trước khi gửi OTP. Không hiện gì khi cơ sở khám chưa soạn điều khoản.
export function TermsConsent({ checked, onChange, invalid, inputId }: { checked: boolean; onChange: (checked: boolean) => void; invalid?: boolean; inputId?: string }) {
  const legal = useLegal().data;
  if (!legal?.terms) return null;
  const link = "font-semibold text-[var(--public-primary)] underline underline-offset-4";
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm leading-6 ${invalid ? "border-[var(--public-danger)]" : "border-[var(--public-border)]"}`}>
      <input id={inputId} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 shrink-0" aria-invalid={invalid || undefined} />
      <span>
        Tôi đã đọc và đồng ý{" "}
        <Link href="/dieu-khoan" target="_blank" className={link}>Điều khoản sử dụng</Link>
        {legal.privacy ? (
          <>
            {" "}và <Link href="/chinh-sach-bao-mat" target="_blank" className={link}>Chính sách bảo mật</Link>
          </>
        ) : null}
        .
      </span>
    </label>
  );
}
