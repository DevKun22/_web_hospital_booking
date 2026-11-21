"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Mail,
  RotateCcw,
} from "lucide-react";
import { DebugOtpBox } from "@/components/ui/debug-otp-box";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { TermsConsent } from "@/components/public/terms-consent";
import { PatientApiError } from "@/lib/patient-portal-api";
import { TERMS_REQUIRED_MESSAGE, termsPayload, useLegal } from "@/lib/legal";
import { usePatientAuth } from "@/lib/patient-auth";

import { BrandLogo } from "@/components/branding/brand-logo";
import { BRAND_NAME } from "@/lib/brand";
type Step = "email" | "otp";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60;
const formatCountdown = (total: number) => `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;

// Chỉ cho phép quay về trang trong cổng người khám để tránh open redirect.
function readSafeNextPath() {
  if (typeof window === "undefined") return "/tai-khoan";
  const next = new URLSearchParams(window.location.search).get("next") || "";
  return /^\/tai-khoan(\/[\w\-/]*)?$/.test(next) ? next : "/tai-khoan";
}

export default function PatientLoginPage() {
  const router = useRouter();
  const { user, loading, requestOtp, verifyOtp } = usePatientAuth();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
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
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && user) router.replace(readSafeNextPath());
  }, [loading, router, user]);

  // Điền sẵn email khi được chuyển từ trang đặt lịch (?email=...).
  useEffect(() => {
    const presetEmail = new URLSearchParams(window.location.search).get("email");
    if (!presetEmail) return;
    const timeoutId = window.setTimeout(() => setEmail(presetEmail.trim().slice(0, 120)), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  // Một đồng hồ chạy cho cả hạn của mã và thời gian chờ gửi lại.
  const ticking = seconds > 0 || resendIn > 0;
  useEffect(() => {
    if (!ticking) return;
    const timer = window.setInterval(() => {
      setSeconds((value) => Math.max(0, value - 1));
      setResendIn((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [ticking]);

  const sendOtp = async () => {
    setError("");
    if (terms && !termsAccepted) {
      setError(TERMS_REQUIRED_MESSAGE);
      return;
    }
    setSubmitting(true);
    try {
      const challenge = await requestOtp(email, termsPayload(terms, termsAccepted));
      setChallengeId(challenge.challengeId);
      setDebugOtp(challenge.debugOtp || "");
      setSentTo(`email ${challenge.maskedTarget ?? email}`);
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
      await verifyOtp(challengeId, otp);
      router.replace(readSafeNextPath());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Mã xác thực không hợp lệ.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="public-site min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">
      <header className="border-b border-[var(--public-border)] bg-[var(--public-surface)]">
        <div className="ui-container flex min-h-16 items-center justify-between gap-4 py-2">
          <Link href="/" className="flex min-w-0 items-center" aria-label={`${BRAND_NAME} - Trang chủ`}>
            <BrandLogo variant="horizontal" size="md" />
          </Link>
          <div className="flex items-center gap-2"><ThemeToggle /><Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]"><ArrowLeft className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">Trang chủ</span></Link></div>
        </div>
      </header>

      <div className="ui-container py-8 sm:py-12">
        <section className="mx-auto w-full max-w-md">
          <h1 className="text-2xl font-bold sm:text-3xl">
            {step === "email" ? "Đăng nhập" : "Nhập mã xác thực"}
          </h1>
          <p className="mt-2 text-base leading-7 text-[var(--public-text-soft)]">
            {step === "email" ? "Dùng email đã đặt lịch. Mã OTP gửi về email, không cần mật khẩu." : `Mã 6 chữ số đã gửi đến ${sentTo}.`}
          </p>

          {error ? <div role="alert" className="mt-5 rounded-lg border border-[var(--public-danger)] bg-[var(--public-danger-soft)] px-4 py-3 text-sm font-medium text-[var(--public-danger)]">{error}</div> : null}

          {step === "email" ? (
            <form onSubmit={handleEmail} className="mt-6 space-y-4">
              <label className="block text-sm font-semibold">
                Email
                <span className="ui-input-shell mt-2 flex min-h-12 items-center border border-[var(--public-border)] bg-[var(--public-surface)] px-3">
                  <Mail className="h-4 w-4 text-[var(--public-muted)]" aria-hidden="true" />
                  <input type="email" inputMode="email" value={email} onChange={(event) => setEmail(event.target.value.trim().slice(0, 120))} autoComplete="username email" className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base font-normal outline-none" required />
                </span>
              </label>
              <TermsConsent checked={termsAccepted} onChange={setTermsAccepted} />
              <button disabled={submitting} className="public-button-primary flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-4 text-base font-semibold disabled:cursor-wait disabled:opacity-70">
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null} Gửi mã OTP
              </button>
            </form>
          ) : (
            <form onSubmit={handleOtp} className="mt-6 space-y-4">
              <label className="block text-sm font-semibold">
                Mã xác thực
                <span className="relative mt-2 block">
                  <span className="flex gap-2" aria-hidden="true">
                    {Array.from({ length: OTP_LENGTH }, (_, index) => (
                      <span key={index} className={`flex min-h-14 flex-1 items-center justify-center rounded-lg border bg-[var(--public-surface)] text-2xl font-bold ${index === Math.min(otp.length, OTP_LENGTH - 1) ? "border-2 border-[var(--public-primary)]" : "border-[var(--public-border)]"}`}>{otp[index] ?? ""}</span>
                    ))}
                  </span>
                  <input ref={otpRef} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))} inputMode="numeric" autoComplete="one-time-code" aria-label="Mã xác thực 6 chữ số" className="login-otp-input absolute inset-0 h-full w-full cursor-text opacity-0" required pattern="[0-9]{6}" />
                </span>
              </label>
              {debugOtp ? <DebugOtpBox otp={debugOtp} onFill={setOtp} /> : null}
              <p className="text-sm leading-5 text-[var(--public-muted)]">
                {seconds > 0 ? `Mã hết hạn sau ${formatCountdown(seconds)}. ` : "Mã đã hết hạn, hãy gửi lại mã. "}
                Chưa thấy thư? Kiểm tra thư rác hoặc xác nhận đúng email.
              </p>
              <button disabled={submitting || otp.length !== 6} className="public-button-primary flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-4 text-base font-semibold disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null} Đăng nhập
              </button>
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <button type="button" onClick={() => { setStep("email"); setOtp(""); setError(""); }} className="min-h-11 font-semibold text-[var(--public-text-soft)] hover:text-[var(--public-primary)]">Đổi email</button>
                <button type="button" disabled={resendIn > 0 || submitting} onClick={sendOtp} className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-[var(--public-primary)] disabled:text-[var(--public-muted)]">
                  <RotateCcw className="h-4 w-4" aria-hidden="true" /> {resendIn > 0 ? `Gửi lại sau ${resendIn}s` : "Gửi lại mã"}
                </button>
              </div>
            </form>
          )}

          <p className="mt-6 border-t border-[var(--public-divider)] pt-4 text-sm leading-5 text-[var(--public-muted)]">
            Chưa có lịch nào?{" "}
            <Link href="/dat-lich" className="font-semibold text-[var(--public-primary)] underline underline-offset-4">Đặt lịch khám</Link>.
            <br />
            Là nhân sự cơ sở khám?{" "}
            <Link href="/login" className="font-semibold text-[var(--public-primary)] underline underline-offset-4">
              Đăng nhập tại đây
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
