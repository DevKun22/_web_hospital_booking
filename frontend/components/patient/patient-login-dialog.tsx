"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, RotateCcw, X } from "lucide-react";
import { DebugOtpBox } from "@/components/ui/debug-otp-box";
import { TermsConsent } from "@/components/public/terms-consent";
import { PatientApiError } from "@/lib/patient-portal-api";
import type { PatientUser } from "@/lib/patient-portal-types";
import { TERMS_REQUIRED_MESSAGE, termsPayload, useLegal } from "@/lib/legal";
import { requestPatientOtp, verifyPatientOtp } from "@/lib/patient-auth";
import { patientSessionQueryKey } from "@/lib/patient-session-client";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;
const formatCountdown = (total: number) => `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;

type Step = "email" | "otp";

/**
 * Popup đăng nhập người khám, hai bước ngay trong hộp: nhập email rồi nhập mã OTP 6 số.
 * Dùng ở đầu trang công khai (đăng nhập xong ở lại trang đang xem) và ở /tai-khoan/dang-nhap (liên kết cũ, email).
 * `verify` cho phép cổng người khám truyền hàm của PatientAuthProvider để phiên trong cổng cập nhật ngay.
 */
export function PatientLoginDialog({
  open,
  onClose,
  onSuccess,
  initialEmail = "",
  verify = verifyPatientOtp,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess?: (user: PatientUser) => void;
  initialEmail?: string;
  verify?: (challengeId: string, otp: string) => Promise<PatientUser>;
}) {
  const queryClient = useQueryClient();
  const titleId = useId();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [debugOtp, setDebugOtp] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [resendIn, setResendIn] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const legalQuery = useLegal();
  const terms = legalQuery.data?.terms ?? null;
  const emailRef = useRef<HTMLInputElement>(null);
  const otpRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Email điền sẵn có thể đến muộn (đọc từ địa chỉ trang sau khi tải).
  useEffect(() => {
    if (!initialEmail) return;
    const id = window.setTimeout(() => setEmail((current) => current || initialEmail), 0);
    return () => window.clearTimeout(id);
  }, [initialEmail]);

  // Mở popup: khóa cuộn trang nền, đặt tiêu điểm vào ô đang cần nhập, Esc để đóng.
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusId = window.requestAnimationFrame(() => (step === "otp" ? otpRef.current : emailRef.current)?.focus());
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !panelRef.current) return;
      // Giữ tiêu điểm trong popup khi bấm Tab.
      const focusable = panelRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([disabled])");
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.cancelAnimationFrame(focusId);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
    // Chỉ chạy khi mở, đóng popup; đổi bước tự đặt tiêu điểm trong sendOtp.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose]);

  // Một đồng hồ chạy cho cả hạn của mã và thời gian chờ gửi lại.
  const ticking = open && (seconds > 0 || resendIn > 0);
  useEffect(() => {
    if (!ticking) return;
    const timer = window.setInterval(() => {
      setSeconds((value) => Math.max(0, value - 1));
      setResendIn((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [ticking]);

  if (!open) return null;

  const sendOtp = async () => {
    setError("");
    if (terms && !termsAccepted) {
      setError(TERMS_REQUIRED_MESSAGE);
      return;
    }
    setSubmitting(true);
    try {
      const challenge = await requestPatientOtp(email, termsPayload(terms, termsAccepted));
      setChallengeId(challenge.challengeId);
      setDebugOtp(challenge.debugOtp || "");
      setSentTo(challenge.maskedTarget ?? email);
      setSeconds(challenge.expiresIn || 300);
      setResendIn(RESEND_COOLDOWN);
      setOtp("");
      setStep("otp");
      window.requestAnimationFrame(() => otpRef.current?.focus());
    } catch (cause) {
      if (cause instanceof PatientApiError && cause.code === "TERMS_OUTDATED") {
        // Điều khoản vừa được cập nhật: tải lại bản mới và bắt đồng ý lại.
        setTermsAccepted(false);
        void legalQuery.refetch();
      }
      setError(cause instanceof Error ? cause.message : "Không thể gửi mã xác thực.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmail = async (event: FormEvent) => {
    event.preventDefault();
    await sendOtp();
  };

  const handleOtp = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const user = await verify(challengeId, otp);
      queryClient.setQueryData(patientSessionQueryKey, user);
      setStep("email");
      setOtp("");
      // Có onSuccess thì nơi gọi tự quyết đóng hay chuyển trang (đóng ở đây có thể kéo về trang chủ).
      if (onSuccess) onSuccess(user);
      else onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mã xác thực không hợp lệ.");
    } finally {
      setSubmitting(false);
    }
  };

  const backToEmail = () => {
    setStep("email");
    setOtp("");
    setError("");
    window.requestAnimationFrame(() => emailRef.current?.focus());
  };

  const link = "font-semibold text-[var(--public-primary)] underline underline-offset-4";

  return (
    <div
      className="public-site fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="login-dialog-rise relative w-full max-w-md rounded-t-3xl border border-[var(--public-border)] bg-[var(--public-surface)] px-5 pb-6 pt-7 text-center text-[var(--public-ink)] shadow-2xl sm:rounded-3xl sm:px-7"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng"
          className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--public-muted)] hover:bg-[var(--public-surface-muted)] hover:text-[var(--public-ink)]"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--public-primary-soft)] text-[var(--public-primary)]" aria-hidden="true">
          <Mail className="h-6 w-6" />
        </span>
        <h2 id={titleId} className="mt-3 text-xl font-semibold">
          {step === "email" ? "Đăng nhập người khám" : "Nhập mã 6 số"}
        </h2>
        <p className="mx-auto mt-1.5 max-w-xs text-sm leading-6 text-[var(--public-text-soft)]">
          {step === "email" ? (
            "Mã OTP gửi về email, không cần mật khẩu."
          ) : (
            <>
              Đã gửi tới <span className="font-semibold text-[var(--public-ink)]">{sentTo}</span> ·{" "}
              <button type="button" onClick={backToEmail} className={link}>Đổi email</button>
            </>
          )}
        </p>

        {error ? <div role="alert" className="mt-4 rounded-lg border border-[var(--public-danger)] bg-[var(--public-danger-soft)] px-4 py-3 text-left text-sm font-medium text-[var(--public-danger)]">{error}</div> : null}

        {step === "email" ? (
          <form onSubmit={handleEmail} className="mt-5 space-y-3 text-left">
            <label className="block text-sm font-semibold">
              Email
              <input
                ref={emailRef}
                type="email"
                inputMode="email"
                value={email}
                onChange={(event) => setEmail(event.target.value.trim().slice(0, 120))}
                autoComplete="username email"
                placeholder="ban@email.com"
                className="ui-input-shell mt-1.5 block min-h-12 w-full border border-[var(--public-border)] bg-[var(--public-surface)] px-3 text-base font-normal outline-none"
                required
              />
            </label>
            <TermsConsent checked={termsAccepted} onChange={setTermsAccepted} />
            <button disabled={submitting} className="public-button-primary flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-4 text-base font-semibold disabled:cursor-wait disabled:opacity-70">
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null} Gửi mã
            </button>
          </form>
        ) : (
          <form onSubmit={handleOtp} className="mt-5 space-y-3">
            <label className="block">
              <span className="sr-only">Mã xác thực 6 chữ số</span>
              <span className="relative block">
                <span className="flex justify-center gap-2" aria-hidden="true">
                  {Array.from({ length: OTP_LENGTH }, (_, index) => (
                    <span key={index} className={`flex h-14 w-11 items-center justify-center rounded-lg border bg-[var(--public-surface)] text-2xl font-semibold ${index === Math.min(otp.length, OTP_LENGTH - 1) ? "border-2 border-[var(--public-primary)]" : "border-[var(--public-border)]"}`}>{otp[index] ?? ""}</span>
                  ))}
                </span>
                <input ref={otpRef} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))} inputMode="numeric" autoComplete="one-time-code" aria-label="Mã xác thực 6 chữ số" className="login-otp-input absolute inset-0 h-full w-full cursor-text opacity-0" required pattern="[0-9]{6}" />
              </span>
            </label>
            {debugOtp ? <DebugOtpBox otp={debugOtp} onFill={setOtp} /> : null}
            <button disabled={submitting || otp.length !== OTP_LENGTH} className="public-button-primary flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-4 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null} Xác nhận
            </button>
            <p className="text-sm text-[var(--public-muted)]" aria-live="polite">
              {seconds > 0 ? `Mã hết hạn sau ${formatCountdown(seconds)}` : "Mã đã hết hạn"}
              {" · "}
              <button type="button" disabled={resendIn > 0 || submitting} onClick={sendOtp} className="inline-flex min-h-11 items-center gap-1 font-semibold text-[var(--public-primary)] disabled:text-[var(--public-muted)]">
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> {resendIn > 0 ? `Gửi lại sau ${resendIn}s` : "Gửi lại mã"}
              </button>
            </p>
          </form>
        )}

        <p className="mt-5 border-t border-[var(--public-divider)] pt-4 text-sm leading-6 text-[var(--public-muted)]">
          Nhân sự cơ sở khám? <Link href="/login" className={link}>Đăng nhập tại đây</Link>
        </p>
      </div>
    </div>
  );
}
