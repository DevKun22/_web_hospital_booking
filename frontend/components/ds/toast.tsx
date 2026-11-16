"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";

// Thông báo nổi dùng chung cho mọi thao tác lưu, cập nhật, thanh toán: hiện ngay chỗ người dùng đang nhìn
// (góc dưới bên phải), tự tắt sau vài giây; lỗi ở lâu hơn để kịp đọc.

type ToastTone = "good" | "bad" | "info";
type ToastItem = { id: number; tone: ToastTone; message: string };

const DISMISS_MS: Record<ToastTone, number> = { good: 4000, info: 4000, bad: 8000 };
const MAX_VISIBLE = 4;

type ToastApi = { success: (message: string) => void; error: (message: string) => void; info: (message: string) => void };

const ToastContext = createContext<ToastApi | null>(null);

const icons = { good: CheckCircle2, bad: XCircle, info: Info } as const;

export function DsToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      if (!message) return;
      const id = nextId.current++;
      // Cùng một nội dung đang hiện thì thay thế, không chồng thêm.
      setItems((current) => [...current.filter((item) => item.message !== message), { id, tone, message }].slice(-MAX_VISIBLE));
      window.setTimeout(() => dismiss(id), DISMISS_MS[tone]);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({ success: (message) => push("good", message), error: (message) => push("bad", message), info: (message) => push("info", message) }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="ds-toasts" aria-live="polite" aria-atomic="false">
        {items.map((item) => {
          const Icon = icons[item.tone];
          return (
            <div key={item.id} className={`ds-toast ds-toast--${item.tone}`} role={item.tone === "bad" ? "alert" : "status"}>
              <Icon aria-hidden="true" className="ds-toast__icon" />
              <span className="ds-toast__text">{item.message}</span>
              <button type="button" className="ds-toast__close" aria-label="Đóng thông báo" onClick={() => dismiss(item.id)}>
                <X aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast phải dùng bên trong DsToastProvider");
  return api;
}

/**
 * Các trang giữ chuỗi `notice` (thành công) và `error` (lỗi) trong state: hook này đẩy mỗi giá trị mới thành một
 * thông báo nổi và xóa state đi để lần thao tác sau cùng nội dung vẫn hiện lại.
 */
export function useActionToast({
  notice,
  error,
  clear,
}: {
  notice?: string;
  error?: string;
  clear?: () => void;
}) {
  const toast = useToast();
  useEffect(() => {
    if (notice) toast.success(notice);
  }, [notice, toast]);
  useEffect(() => {
    if (error) toast.error(error);
  }, [error, toast]);
  const clearRef = useRef(clear);
  useEffect(() => {
    clearRef.current = clear;
  });
  useEffect(() => {
    if (!notice && !error) return;
    const timeoutId = window.setTimeout(() => clearRef.current?.(), 300);
    return () => window.clearTimeout(timeoutId);
  }, [notice, error]);
}
