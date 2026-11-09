"use client";

import { ClipboardEvent, FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, Hospital, Loader2 } from "lucide-react";
import { DsButton, DsField, DsInput, DsNotice, DsRoot, describedBy } from "@/components/ds";
import { DebugOtpBox } from "@/components/ui/debug-otp-box";
import { useAuth } from "@/lib/auth";
import { usePublicSiteSettings } from "@/lib/public-home-query";

type LoginStep = "credentials" | "otp";
type OtpDeliveryStatus = "PENDING" | "SENT" | "FAILED";

const OTP_LENGTH = 6;
// Chờ trước khi cho gửi lại mã, để không gửi dồn dập.
const RESEND_COOLDOWN_SECONDS = 45;

const buildOtpNotice = (channel: "SMS" | "EMAIL", target: string, status?: OtpDeliveryStatus) => {
  const targetLabel = channel === "EMAIL" ? "email" : "số điện thoại";

  if (status === "SENT") return `Đã gửi mã OTP đến ${targetLabel} ${target}.`;
  if (status === "FAILED") return `Chưa gửi được mã OTP đến ${targetLabel} ${target}. Hãy thử gửi lại.`;
  return `Đã tiếp nhận yêu cầu gửi OTP. Kiểm tra ${targetLabel} ${target} trong giây lát.`;
};

const formatClock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, login, verifyOtp } = useAuth();
  const siteSettingsQuery = usePublicSiteSettings();
  const [step, setStep] = useState<LoginStep>("credentials");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [digits, setDigits] = useState<string[]>(() => Array(OTP_LENGTH).fill(""));
  const [challengeId, setChallengeId] = useState("");
  const [otpTarget, setOtpTarget] = useState("");
  const [otpChannel, setOtpChannel] = useState<"SMS" | "EMAIL">("SMS");
  const [debugOtp, setDebugOtp] = useState("");
  const [expiresLeft, setExpiresLeft] = useState(0);
  const [resendLeft, setResendLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const siteSettings = siteSettingsQuery.data || null;
  const hospitalName = siteSettings?.hospitalName?.trim() || "Hospital Booking";
  const logo = siteSettings?.logo?.trim();
  const otp = digits.join("");

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, router, user]);

  // Đếm ngược hạn dùng của mã và thời gian chờ gửi lại, mỗi giây một lần.
  useEffect(() => {
    if (step !== "otp") return;
    const id = window.setInterval(() => {
      setExpiresLeft((current) => Math.max(0, current - 1));
      setResendLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [step]);

  const applyChallenge = (result: Awaited<ReturnType<typeof login>>) => {
    const target = result.otpTarget || result.email || result.phone;
    const channel = result.otpChannel || "SMS";
    setChallengeId(result.challengeId);
    setOtpTarget(target);
    setOtpChannel(channel);
    setDebugOtp(result.debugOtp || "");
    setExpiresLeft(result.otpExpiresIn);
    setResendLeft(RESEND_COOLDOWN_SECONDS);
    setDigits(Array(OTP_LENGTH).fill(""));
    setNotice(buildOtpNotice(channel, target, result.otpDeliveryStatus));
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      applyChallenge(await login(phone.trim(), password));
      setStep("otp");
      window.requestAnimationFrame(() => otpRefs.current[0]?.focus());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setSubmitting(true);
    try {
      applyChallenge(await login(phone.trim(), password));
      window.requestAnimationFrame(() => otpRefs.current[0]?.focus());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi lại được mã OTP");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (otp.length !== OTP_LENGTH) return;
    setError("");
    setNotice("");
    setSubmitting(true);

    try {
      await verifyOtp(challengeId, otp);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xác thực OTP thất bại");
      setDigits(Array(OTP_LENGTH).fill(""));
      window.requestAnimationFrame(() => otpRefs.current[0]?.focus());
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePhone = () => {
    setStep("credentials");
    setPhone("");
    setPassword("");
    setDigits(Array(OTP_LENGTH).fill(""));
    setChallengeId("");
    setOtpTarget("");
    setDebugOtp("");
    setExpiresLeft(0);
    setResendLeft(0);
    setSubmitting(false);
    setError("");
    setNotice("");
    window.requestAnimationFrame(() => phoneInputRef.current?.focus());
  };

  const setDigitAt = (index: number, value: string) => {
    setDigits((current) => current.map((item, position) => (position === index ? value : item)));
  };

  const onDigitChange = (index: number, raw: string) => {
    const onlyDigits = raw.replace(/\D/g, "");
    if (!onlyDigits) {
      setDigitAt(index, "");
      return;
    }
    // Nhiều số cùng lúc (tự điền OTP của điện thoại): rải vào các ô kế tiếp.
    if (onlyDigits.length > 1) {
      fillFrom(index, onlyDigits);
      return;
    }
    setDigitAt(index, onlyDigits);
    if (index < OTP_LENGTH - 1) otpRefs.current[index + 1]?.focus();
  };

  const fillFrom = (start: number, value: string) => {
    const incoming = value.replace(/\D/g, "").slice(0, OTP_LENGTH - start).split("");
    if (incoming.length === 0) return;
    setDigits((current) => current.map((item, position) => (position >= start && position < start + incoming.length ? incoming[position - start] : item)));
    otpRefs.current[Math.min(start + incoming.length, OTP_LENGTH - 1)]?.focus();
  };

  const onDigitKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      setDigitAt(index - 1, "");
      otpRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      otpRefs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      event.preventDefault();
      otpRefs.current[index + 1]?.focus();
    }
  };

  const onDigitPaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    fillFrom(index, event.clipboardData.getData("text"));
  };

  const fillDebugOtp = (value: string) => setDigits(value.replace(/\D/g, "").slice(0, OTP_LENGTH).padEnd(OTP_LENGTH, " ").split("").map((item) => item.trim()));

  const otpTargetLabel = otpChannel === "EMAIL" ? "email" : "số điện thoại";

  return (
    <DsRoot className="ds-login">
      <main className="ds-login__main">
        <div className="ds-login__card">
          <div className="ds-login__top">
            <Link href="/" className="ds-login__brand">
              <span className="ds-brand-mark">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {logo ? <img src={logo} alt="" /> : <Hospital aria-hidden="true" />}
              </span>
              <strong>{hospitalName}</strong>
            </Link>
            <Link href="/" className="ds-btn">
              Website
            </Link>
          </div>

          <ol className="ds-login__steps" aria-label="Các bước đăng nhập" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            <li aria-current={step === "credentials" ? "step" : undefined}>1 Mật khẩu</li>
            <i aria-hidden="true" />
            <li aria-current={step === "otp" ? "step" : undefined}>2 Mã OTP</li>
          </ol>

          <h1>{step === "credentials" ? "Đăng nhập quản trị" : "Nhập mã OTP"}</h1>
          <p className="ds-login__lead">
            {step === "credentials"
              ? "Dùng số điện thoại và mật khẩu của tài khoản được cấp."
              : `Mã 6 số đã được gửi đến ${otpTargetLabel} ${otpTarget}.`}
          </p>

          {error ? <DsNotice tone="bad">{error}</DsNotice> : null}
          {notice && !error ? <DsNotice tone="good">{notice}</DsNotice> : null}

          {step === "credentials" ? (
            <form className="ds-login__form" onSubmit={handleLogin}>
              <DsField label="Số điện thoại" htmlFor="login-phone" required>
                <DsInput
                  id="login-phone"
                  ref={phoneInputRef}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="0901234567"
                  autoComplete="username tel"
                  autoFocus
                  required
                />
              </DsField>
              <DsField label="Mật khẩu" htmlFor="login-password" required>
                <span className="ds-input-wrap">
                  <DsInput
                    id="login-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </button>
                </span>
              </DsField>
              <DsButton type="submit" variant="primary" size="lg" disabled={submitting}>
                {submitting ? <Loader2 className="ds-spin" aria-hidden="true" /> : null}
                {submitting ? "Đang gửi mã OTP" : "Tiếp tục"}
              </DsButton>
            </form>
          ) : (
            <form className="ds-login__form" onSubmit={handleVerify}>
              <DebugOtpBox otp={debugOtp} onFill={fillDebugOtp} />

              <DsField
                label="Mã OTP"
                htmlFor="login-otp-0"
                hint={expiresLeft > 0 ? `Mã còn hiệu lực ${formatClock(expiresLeft)}` : "Mã đã hết hạn, hãy gửi lại mã mới"}
              >
                <div className="ds-otp" role="group" aria-label="Mã OTP 6 số" data-invalid={error ? "true" : undefined}>
                  {digits.map((digit, index) => (
                    <input
                      key={index}
                      id={`login-otp-${index}`}
                      ref={(node) => {
                        otpRefs.current[index] = node;
                      }}
                      value={digit}
                      onChange={(event) => onDigitChange(index, event.target.value)}
                      onKeyDown={(event) => onDigitKeyDown(index, event)}
                      onPaste={(event) => onDigitPaste(index, event)}
                      onFocus={(event) => event.target.select()}
                      inputMode="numeric"
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      aria-label={`Số thứ ${index + 1}`}
                      aria-describedby={index === 0 ? describedBy("login-otp-0", { hint: "x" }) : undefined}
                      maxLength={OTP_LENGTH}
                    />
                  ))}
                </div>
              </DsField>

              <DsButton type="submit" variant="primary" size="lg" disabled={submitting || otp.length !== OTP_LENGTH || expiresLeft === 0}>
                {submitting ? <Loader2 className="ds-spin" aria-hidden="true" /> : null}
                {submitting ? "Đang xác thực" : "Vào dashboard"}
              </DsButton>

              <div className="ds-login__row">
                <button type="button" className="ds-login__link" onClick={handleResend} disabled={submitting || resendLeft > 0}>
                  {resendLeft > 0 ? `Gửi lại mã sau ${resendLeft} giây` : "Gửi lại mã"}
                </button>
                <button type="button" className="ds-login__link" onClick={handleChangePhone}>
                  <ArrowLeft aria-hidden="true" style={{ width: 13, height: 13, verticalAlign: "-2px", marginRight: 4 }} />
                  Đổi số điện thoại
                </button>
              </div>
            </form>
          )}

          <p className="ds-login__foot">Không chia sẻ mã OTP với bất kỳ ai, kể cả người tự nhận là quản trị hệ thống.</p>
        </div>
        <p className="ds-login__status">Đăng nhập hai bước: mật khẩu và mã OTP</p>
      </main>
    </DsRoot>
  );
}
