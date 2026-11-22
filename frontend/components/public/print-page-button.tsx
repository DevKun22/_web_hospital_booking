"use client";

import { Printer } from "lucide-react";

// Nút in trang (hộp thoại in của trình duyệt); văn bản pháp lý thường cần lưu hoặc in.
export function PrintPageButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-[var(--public-primary)] underline underline-offset-4 print:hidden"
    >
      <Printer className="h-4 w-4" aria-hidden="true" />
      In trang này
    </button>
  );
}
