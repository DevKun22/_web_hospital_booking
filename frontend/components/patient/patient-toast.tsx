"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";

// Thông báo nổi phía người khám (cổng tài khoản và luồng đặt lịch): mọi kết quả thao tác hiện ở góc trên bên phải,
// tự tắt sau vài giây, lỗi ở lâu hơn. Cùng cách dùng với thông báo nổi của dashboard nhưng theo màu của trang công khai.

type Tone = "good" | "bad" | "info";
type Item = { id: number; tone: Tone; message: string };
type Api = { success: (message: string) => void; error: (message: string) => void; info: (message: string) => void };

const DISMISS_MS: Record<Tone, number> = { good: 4000, info: 4000, bad: 8000 };
const MAX_VISIBLE = 3;
const ICONS = { good: CheckCircle2, bad: XCircle, info: Info } as const;
const COLORS: Record<Tone, string> = { good: "var(--public-success)", bad: "var(--public-danger)", info: "var(--public-primary)" };

const ToastContext = createContext<Api | null>(null);

export function PatientToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setItems((current) => current.filter((item) => item.id !== id)), []);
  const push = useCallback(
    (tone: Tone, message: string) => {
      if (!message) return;
      const id = nextId.current++;
      setItems((current) => [...current.filter((item) => item.message !== message), { id, tone, message }].slice(-MAX_VISIBLE));
      window.setTimeout(() => dismiss(id), DISMISS_MS[tone]);
    },
    [dismiss],
  );
  const api = useMemo<Api>(
    () => ({ success: (message) => push("good", message), error: (message) => push("bad", message), info: (message) => push("info", message) }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* public-site chỉ để nhận biến màu; vùng này không có nền hay bố cục riêng. */}
      <div className="public-site pointer-events-none fixed right-3 top-3 z-[90] flex w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-2 !bg-transparent sm:right-4 sm:top-4" aria-live="polite">
        {items.map((item) => {
          const Icon = ICONS[item.tone];
          return (
            <div
              key={item.id}
              role={item.tone === "bad" ? "alert" : "status"}
              className="pointer-events-auto flex items-start gap-2.5 rounded-lg border border-[var(--public-border)] border-l-4 bg-[var(--public-surface)] py-3 pl-3 pr-2 text-sm leading-5 text-[var(--public-ink)] shadow-lg"
              style={{ borderLeftColor: COLORS[item.tone] }}
            >
              <Icon aria-hidden="true" className="mt-0.5 h-[18px] w-[18px] shrink-0" style={{ color: COLORS[item.tone] }} />
              <span className="min-w-0 flex-1 break-words">{item.message}</span>
              <button type="button" aria-label="Đóng thông báo" onClick={() => dismiss(item.id)} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[var(--public-muted)] hover:bg-[var(--public-surface-muted)]">
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function usePatientToast(): Api {
  const api = useContext(ToastContext);
  if (!api) throw new Error("usePatientToast phải dùng bên trong PatientToastProvider");
  return api;
}

type MutationLike = { status: "idle" | "pending" | "success" | "error"; error: unknown; submittedAt: number };

/** Báo kết quả một mutation: lỗi luôn hiện; thành công hiện khi có nội dung `success`. Mỗi lần gửi báo đúng một lần. */
export function useMutationToast(mutation: MutationLike, options: { success?: string; fallbackError: string }) {
  const toast = usePatientToast();
  const { success, fallbackError } = options;
  const reported = useRef(0);
  useEffect(() => {
    if (mutation.submittedAt === 0 || reported.current === mutation.submittedAt) return;
    if (mutation.status === "error") {
      reported.current = mutation.submittedAt;
      toast.error(mutation.error instanceof Error ? mutation.error.message : fallbackError);
    } else if (mutation.status === "success") {
      reported.current = mutation.submittedAt;
      if (success) toast.success(success);
    }
  }, [mutation.status, mutation.error, mutation.submittedAt, success, fallbackError, toast]);
}

/** Cho nơi chỉ có chuỗi thông báo trong state (luồng đặt lịch): đẩy mỗi giá trị mới thành thông báo nổi. */
export function useMessageToast(message: string, tone: "success" | "error" | "info") {
  const toast = usePatientToast();
  useEffect(() => {
    if (message) toast[tone](message);
  }, [message, tone, toast]);
}
