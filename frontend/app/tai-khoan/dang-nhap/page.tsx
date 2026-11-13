"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  Phone,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { DebugOtpBox } from "@/components/ui/debug-otp-box";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { usePatientAuth } from "@/lib/patient-auth";

import { BrandLogo } from "@/components/branding/brand-logo";
import { BRAND_NAME } from "@/lib/brand";
type Step = "phone" | "otp";

// Chỉ cho phép quay về trang trong cổng bệnh nhân để tránh open redirect.
function readSafeNextPath() {
  if (typeof window === "undefined") return "/tai-khoan";
  const next = new URLSearchParams(window.location.search).get("next") || "";
  return /^\/tai-khoan(\/[\w\-/]*)?$/.test(next) ? next : "/tai-khoan";
}

export default function PatientLoginPage() {
  const router = useRouter();
  const { user, loading, requestOtp, verifyOtp } = usePatientAuth();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [debugOtp, setDebugOtp] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && user) router.replace(readSafeNextPath());
  }, [loading, router, user]);

  // Điền sẵn SĐT khi được chuyển từ trang tra cứu cũ (?phone=...).
  useEffect(() => {
    const presetPhone = new URLSearchParams(window.location.search).get("phone");
    if (!presetPhone) return;
    const timeoutId = window.setTimeout(() => setPhone(presetPhone.replace(/\D/g, "").slice(0, 10)), 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [seconds]);

  const sendOtp = async () => {
    setError("");
    setSubmitting(true);
    try {
      const challenge = await requestOtp(phone);
      setChallengeId(challenge.challengeId);
      setDebugOtp(challenge.debugOtp || "");
      setSentTo(
        challenge.maskedTarget
          ? `${challenge.channel === "EMAIL" ? "email" : "số điện thoại"} ${challenge.maskedTarget}`
          : phone,
      );
      setSeconds(challenge.expiresIn || 300);
      setOtp("");
      setStep("otp");
      window.requestAnimationFrame(() => otpRef.current?.focus());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể gửi mã xác thực.");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhone = async (event: FormEvent) => {
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
          <div className="flex items-center gap-2"><ThemeToggle /><Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]"><ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Trang chủ</span></Link></div>
        </div>
      </header>

      <div className="ui-container grid min-h-[calc(100vh-4rem)] items-start gap-8 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,460px)] lg:items-center lg:py-12">
        <section className="hidden max-w-2xl lg:block">
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--public-primary-soft)] px-3 py-1.5 text-xs font-bold text-[var(--public-primary-dark)]">
            <ShieldCheck className="h-4 w-4" /> Dùng chung tài khoản với ứng dụng Mobile
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-tight tracking-[-0.035em] xl:text-5xl">
            Thông tin chăm sóc sức khỏe trong một nơi an toàn
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[var(--public-text-soft)]">
            Xem lịch hẹn, kết quả khám, đơn thuốc, hóa đơn và hồ sơ người thân bằng đúng tài khoản đang dùng trên ứng dụng.
          </p>
          <div className="mt-8 grid max-w-xl grid-cols-2 gap-3 text-sm text-[var(--public-text-soft)]">
            {["Đăng nhập OTP, không cần mật khẩu", "Dữ liệu đồng bộ Web và Mobile", "Quản lý phiên đăng nhập", "Bảo vệ thông tin y tế cá nhân"].map((item) => (
              <div key={item} className="flex items-start gap-2 rounded-xl border border-[var(--public-border)] bg-white p-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--public-care-mint)]" /> {item}
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-md rounded-3xl border border-[var(--public-border)] bg-white p-5 shadow-[var(--public-shadow-floating)] sm:p-7">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--public-primary-soft)] text-[var(--public-primary)]">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-[var(--public-primary)]">Cổng thông tin người khám</p>
          <h2 className="mt-2 text-2xl font-bold tracking-[-0.025em]">
            {step === "phone" ? "Đăng nhập bằng SĐT hoặc email" : "Nhập mã xác thực"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--public-muted)]">
            {step === "phone" ? "Dùng số điện thoại hoặc email đã dùng khi đặt lịch. Mã OTP được gửi qua kênh hệ thống đang hỗ trợ." : `Mã gồm 6 chữ số đã được gửi đến ${sentTo}.`}
          </p>

          {error ? <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div> : null}

          {step === "phone" ? (
            <form onSubmit={handlePhone} className="mt-6 space-y-5">
              <label className="block text-sm font-semibold">
                Số điện thoại hoặc email
                <span className="ui-input-shell mt-2 flex min-h-12 items-center border border-[var(--public-border)] bg-white px-3">
                  <Phone className="h-4 w-4 text-[var(--public-muted)]" aria-hidden="true" />
                  <input value={phone} onChange={(event) => { const value = event.target.value.trim(); setPhone(/[a-zA-Z@]/.test(value) ? value.slice(0, 120) : value.replace(/\D/g, "").slice(0, 10)); }} autoComplete="username" placeholder="0912 345 678 hoặc ban@email.com" className="min-w-0 flex-1 bg-transparent px-3 py-3 outline-none" required />
                </span>
              </label>
              <button disabled={submitting} className="public-button-primary flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 font-bold disabled:cursor-wait disabled:opacity-70">
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : null} Gửi mã OTP
              </button>
            </form>
          ) : (
            <form onSubmit={handleOtp} className="mt-6 space-y-5">
              <label className="block text-sm font-semibold">
                Mã xác thực
                <input ref={otpRef} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="• • • • • •" className="login-otp-input mt-2 min-h-14 w-full rounded-xl border border-[var(--public-border)] bg-white px-4 text-center text-2xl font-bold tracking-[0.45em] outline-none focus:border-[var(--public-primary)] focus:ring-4 focus:ring-blue-100" required pattern="[0-9]{6}" />
              </label>
              {debugOtp ? <DebugOtpBox otp={debugOtp} onFill={setOtp} /> : null}
              <button disabled={submitting || otp.length !== 6} className="public-button-primary flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 font-bold disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : null} Đăng nhập
              </button>
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <button type="button" onClick={() => { setStep("phone"); setOtp(""); setError(""); }} className="font-semibold text-[var(--public-text-soft)] hover:text-[var(--public-primary)]">Đổi SĐT / email</button>
                <button type="button" disabled={seconds > 0 || submitting} onClick={sendOtp} className="inline-flex items-center gap-1.5 font-semibold text-[var(--public-primary)] disabled:text-[var(--public-muted)]">
                  <RotateCcw className="h-4 w-4" /> {seconds > 0 ? `Gửi lại sau ${seconds}s` : "Gửi lại mã"}
                </button>
              </div>
            </form>
          )}

          <p className="mt-6 border-t border-[var(--public-divider)] pt-5 text-xs leading-5 text-[var(--public-muted)]">
            Tiếp tục đăng nhập nghĩa là bạn đồng ý với quy định bảo mật và chỉ truy cập hồ sơ thuộc quyền quản lý của mình.
          </p>
        </section>
      </div>
    </main>
  );
}

