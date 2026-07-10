"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Hospital,
  Loader2,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { DebugOtpBox } from "@/components/ui/debug-otp-box";
import { useAuth } from "@/lib/auth";
import { usePublicSiteSettings } from "@/lib/public-home-query";

type LoginStep = "credentials" | "otp";
type OtpDeliveryStatus = "PENDING" | "SENT" | "FAILED";

const buildOtpNotice = (channel: "SMS" | "EMAIL", target: string, status?: OtpDeliveryStatus) => {
  const targetLabel = channel === "EMAIL" ? "email" : "số điện thoại";

  if (status === "SENT") {
    return `Đã gửi mã OTP đến ${targetLabel} ${target}.`;
  }

  if (status === "FAILED") {
    return `Chưa gửi được mã OTP đến ${targetLabel} ${target}. Vui lòng thử gửi lại.`;
  }

  return `Yêu cầu gửi OTP đã được tiếp nhận. Vui lòng kiểm tra ${targetLabel} ${target} trong giây lát.`;
};

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, login, verifyOtp } = useAuth();
  const siteSettingsQuery = usePublicSiteSettings();
  const [step, setStep] = useState<LoginStep>("credentials");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [otpTarget, setOtpTarget] = useState("");
  const [otpChannel, setOtpChannel] = useState<"SMS" | "EMAIL">("SMS");
  const [otpDeliveryStatus, setOtpDeliveryStatus] = useState<OtpDeliveryStatus>("PENDING");
  const [debugOtp, setDebugOtp] = useState("");
  const [expiresIn, setExpiresIn] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const phoneInputRef = useRef<HTMLInputElement>(null);

  const siteSettings = siteSettingsQuery.data || null;
  const hospitalName = siteSettings?.hospitalName?.trim() || "Hospital Booking";
  const logo = siteSettings?.logo?.trim();
  const otpTargetLabel = otpChannel === "EMAIL" ? "email" : "số điện thoại";
  const otpTargetText = otpTarget || phone;
  const otpDescription =
    otpDeliveryStatus === "SENT"
      ? `Mã OTP đã gửi đến ${otpTargetLabel} ${otpTargetText}.`
      : otpDeliveryStatus === "FAILED"
        ? `Chưa gửi được mã OTP đến ${otpTargetLabel} ${otpTargetText}.`
        : `Mã OTP đang được gửi đến ${otpTargetLabel} ${otpTargetText}.`;

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, router, user]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const result = await login(phone.trim(), password);
      setChallengeId(result.challengeId);
      setOtpTarget(result.otpTarget || result.email || result.phone);
      setOtpChannel(result.otpChannel || "SMS");
      setOtpDeliveryStatus(result.otpDeliveryStatus || "PENDING");
      setDebugOtp(result.debugOtp || "");
      setExpiresIn(result.otpExpiresIn);
      setSuccessMessage(
        buildOtpNotice(
          result.otpChannel || "SMS",
          result.otpTarget || result.email || result.phone,
          result.otpDeliveryStatus,
        ),
      );
      setStep("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");
    setSubmitting(true);

    try {
      await verifyOtp(challengeId, otp.trim());
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xác thực OTP thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePhone = () => {
    setStep("credentials");
    setPhone("");
    setPassword("");
    setOtp("");
    setChallengeId("");
    setOtpTarget("");
    setOtpChannel("SMS");
    setOtpDeliveryStatus("PENDING");
    setDebugOtp("");
    setExpiresIn(null);
    setSubmitting(false);
    setError("");
    setSuccessMessage("");
    window.requestAnimationFrame(() => phoneInputRef.current?.focus());
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f9ff] px-4 py-8 text-[#172033]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(13,79,139,0.14),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(31,122,58,0.12),transparent_30%)]" />

      <section className="relative w-full max-w-md rounded-2xl border border-[#d7e7f8] bg-white/95 p-5 shadow-[0_24px_70px_rgba(13,79,139,0.14)] ring-1 ring-white sm:p-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#e7f0fb] text-[#0d4f8b] ring-1 ring-[#d8e9ff]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {logo ? <img src={logo} alt={hospitalName} className="h-full w-full object-contain p-1" /> : <Hospital className="h-6 w-6" />}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-semibold">{hospitalName}</span>
              <span className="block truncate text-xs text-[#667892]">Dashboard quản trị</span>
            </span>
          </Link>
          <Link href="/" className="shrink-0 rounded-lg border border-[#cfd8e6] bg-white px-3 py-2 text-sm font-semibold text-[#42526b] shadow-sm transition hover:bg-[#f6f8fb]">
            Website
          </Link>
        </div>

        <div className="mb-5">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#e7f0fb] text-[#0d4f8b] ring-1 ring-[#d8e9ff]">
            {step === "credentials" ? <LockKeyhole className="h-6 w-6" /> : otpChannel === "EMAIL" ? <Mail className="h-6 w-6" /> : <Smartphone className="h-6 w-6" />}
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[#0d4f8b]">
            {step === "credentials" ? "Đăng nhập dashboard" : "Xác thực bảo mật"}
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[#172033]">
            {step === "credentials" ? "Chào mừng quay lại" : "Nhập mã OTP"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#667892]">
            {step === "credentials"
              ? "Đăng nhập bằng tài khoản đã được cấp quyền để vào hệ thống quản trị."
              : `${otpDescription} ${expiresIn ? `Hiệu lực trong ${expiresIn} giây.` : ""}`}
          </p>
        </div>

        <div className="mb-5 grid grid-cols-2 rounded-xl border border-[#d8e9ff] bg-[#eef6ff] p-1 text-xs font-semibold">
          <span className={`rounded-lg px-2 py-2 text-center transition ${step === "credentials" ? "bg-white text-[#0d4f8b] shadow-sm" : "text-[#667892]"}`}>
            1. Đăng nhập
          </span>
          <span className={`rounded-lg px-2 py-2 text-center transition ${step === "otp" ? "bg-white text-[#0d4f8b] shadow-sm" : "text-[#667892]"}`}>
            2. OTP
          </span>
        </div>

        {error ? (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-[#f2b8b5] bg-[#fff3f2] px-3 py-2.5 text-sm font-medium text-[#b3261e]">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {successMessage ? (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-[#b7e4c7] bg-[#effaf3] px-3 py-2.5 text-sm font-medium text-[#166534]">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        ) : null}

        {step === "credentials" ? (
          <form className="space-y-4" onSubmit={handleLogin}>
            <label className="block">
              <span className="text-sm font-medium text-[#334155]">Số điện thoại</span>
              <div className="login-input-shell mt-1 flex items-center rounded-xl border border-[#cfd8e6] bg-[#fbfdff] px-3 transition">
                <Phone className="h-4 w-4 shrink-0 text-[#667892]" />
                <input
                  ref={phoneInputRef}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="0901234567"
                  autoComplete="username tel"
                  className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm"
                  required
                />
              </div>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-[#334155]">Mật khẩu</span>
              <div className="login-input-shell mt-1 flex items-center rounded-xl border border-[#cfd8e6] bg-[#fbfdff] px-3 transition">
                <LockKeyhole className="h-4 w-4 shrink-0 text-[#667892]" />
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="rounded-lg p-1.5 text-[#667892] hover:bg-[#eef4fb] focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cfe4fa]"
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0d4f8b] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(13,79,139,0.22)] transition hover:bg-[#083d6d] disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {submitting ? "Đang gửi OTP..." : "Tiếp tục"}
            </button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={handleVerify}>
            <DebugOtpBox otp={debugOtp} onFill={setOtp} />

            <label className="block">
              <span className="text-sm font-medium text-[#334155]">Mã OTP</span>
              <input
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                className="login-otp-input ui-field mt-1 w-full rounded-xl bg-[#fbfdff] px-3 py-3 text-center text-xl font-semibold tracking-[0.25em] focus-visible:outline-none"
                required
              />
            </label>

            <button
              type="submit"
              disabled={submitting || otp.length !== 6}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0d4f8b] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(13,79,139,0.22)] transition hover:bg-[#083d6d] disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {submitting ? "Đang xác thực..." : "Vào dashboard"}
            </button>

            <button
              type="button"
              onClick={handleChangePhone}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#cfd8e6] bg-white px-4 py-3 text-sm font-semibold text-[#42526b] transition hover:bg-[#f6f8fb]"
            >
              <ArrowLeft className="h-4 w-4" />
              Đổi số điện thoại
            </button>
          </form>
        )}

        <div className="mt-5 flex items-start gap-2 rounded-xl border border-[#d8e9ff] bg-[#f8fbff] px-3 py-2.5 text-xs leading-5 text-[#667892]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0d4f8b]" />
          <p>Sau khi xác thực OTP thành công, hệ thống sẽ mở dashboard theo đúng quyền tài khoản.</p>
        </div>
      </section>
    </main>
  );
}
