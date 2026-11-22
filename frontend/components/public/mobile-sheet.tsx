"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

// Tấm trượt từ dưới lên cho điện thoại (menu thêm, nhóm Dịch vụ). Dựng qua portal để không bị header (có lọc nền mờ) giữ làm khung định vị; nằm trên thanh điều hướng dưới.
// Đóng bằng nút X, Esc hoặc chạm nền mờ; khóa cuộn trang phía sau trong lúc mở; hoạt ảnh trượt tắt khi người dùng chọn giảm chuyển động.
export function MobileSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    // Lớp public-site để nhận bảng màu --public-* (chỉ khai báo trong vùng đó, còn portal nằm ngoài).
    <div className="public-site fixed inset-0 z-[90] bg-transparent">
      <button type="button" aria-label="Đóng" tabIndex={-1} onClick={onClose} className="mobile-sheet__backdrop absolute inset-0 bg-black/45" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="mobile-sheet absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-[var(--public-border)] bg-[var(--public-surface)] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 text-[var(--public-ink)] shadow-2xl"
      >
        <div className="mx-auto mb-1 h-1 w-9 rounded-full bg-[var(--public-border)]" aria-hidden="true" />
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            data-autofocus
            onClick={onClose}
            aria-label="Đóng"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)] focus-visible:outline-2 focus-visible:outline-[var(--public-primary)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
