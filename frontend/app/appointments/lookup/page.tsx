"use client";

import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  FlaskConical,
  Loader2,
  Phone,
  Pill,
  Search,
  ShieldCheck,
  Star,
  Stethoscope,
} from "lucide-react";
import Link from "next/link";
import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DebugOtpBox } from "@/components/ui/debug-otp-box";
import { PublicPageHeader, PublicPageHero } from "@/components/public/public-page-layout";
import { apiRequest } from "@/lib/api";
import { formatVietnamDate, formatVietnamDateTime } from "@/lib/date";
import { getPublicLookupDraft } from "@/lib/public-booking-store";
import type {
  AppointmentStatus,
  LabResult,
  PaymentProvider,
  PaymentTransaction,
  Prescription,
  PublicAppointmentInvoice,
} from "@/lib/types";

type DisplayAppointment = {
  id: string;
  bookingCode: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  reason: string | null;
  patientName: string;
  patientPhone: string;
  estimatedPrice: number;
  serviceFee: number;
  bhytDiscount: number;
  finalAmount: number;
  confirmedAt: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  doctor: {
    id: string;
    title: string | null;
    specialization: string | null;
    user: {
      fullName: string;
      avatar: string | null;
    };
  };
  department: {
    id: string;
    name: string;
    slug: string | null;
  };
  package: {
    id: string;
    name: string;
    slug: string | null;
  } | null;
  invoice: PublicAppointmentInvoice | null;
};

type LookupOtpResponse = {
  phone: string;
  items: DisplayAppointment[];
};

type PublicAppointmentResult = {
  appointment: Pick<
    DisplayAppointment,
    | "id"
    | "bookingCode"
    | "appointmentDate"
    | "startTime"
    | "endTime"
    | "status"
    | "patientName"
    | "patientPhone"
    | "completedAt"
    | "doctor"
    | "department"
  >;
  medicalRecord: {
    id: string;
    recordCode: string;
    symptoms: string | null;
    diagnosis: string | null;
    treatment: string | null;
    prescription: string | null;
    doctorNotes: string | null;
    status: "PUBLISHED";
    resultPdfUrl: string | null;
    publishedAt: string | null;
    createdAt: string;
    updatedAt: string;
    labResults: LabResult[];
  } | null;
  prescription: Pick<
    Prescription,
    | "id"
    | "prescriptionCode"
    | "status"
    | "note"
    | "issuedAt"
    | "cancelledAt"
    | "createdAt"
    | "updatedAt"
    | "items"
  > | null;
};

const statusLabels: Record<
  AppointmentStatus,
  { label: string; tone: string; next: string }
> = {
  PENDING_OTP: {
    label: "Chờ xác thực OTP",
    tone: "border-[#f4d48b] bg-[#fff8eb] text-[#8a5a00]",
    next: "Vui lòng xác thực OTP để bệnh viện tiếp nhận lịch.",
  },
  PENDING_CONFIRM: {
    label: "Chờ bệnh viện xác nhận",
    tone: "border-[#cfe4fa] bg-[#f3f8ff] text-[#0d4f8b]",
    next: "Bệnh viện sẽ kiểm tra lịch và xác nhận trong thời gian sớm nhất.",
  },
  CONFIRMED: {
    label: "Đã xác nhận",
    tone: "border-[#bde5c8] bg-[#f0fff4] text-[#1f7a3a]",
    next: "Vui lòng đến đúng giờ và mang theo giấy tờ cần thiết.",
  },
  CHECKED_IN: {
    label: "Đã check-in",
    tone: "border-[#bde5c8] bg-[#f0fff4] text-[#1f7a3a]",
    next: "Bạn đã được tiếp nhận tại bệnh viện.",
  },
  IN_PROGRESS: {
    label: "Đang khám",
    tone: "border-[#cfe4fa] bg-[#f3f8ff] text-[#0d4f8b]",
    next: "Quá trình khám đang được thực hiện.",
  },
  COMPLETED: {
    label: "Hoàn tất",
    tone: "border-[#d8e2ef] bg-[#f8fafc] text-[#42526b]",
    next: "Lịch khám đã hoàn tất. Bạn có thể theo dõi hồ sơ khi bệnh viện công bố kết quả.",
  },
  RESCHEDULED: {
    label: "Đã đổi lịch",
    tone: "border-[#f4d48b] bg-[#fff8eb] text-[#8a5a00]",
    next: "Lịch đã được điều chỉnh. Vui lòng kiểm tra lại thời gian mới.",
  },
  CANCELLED_BY_PATIENT: {
    label: "Người bệnh đã hủy",
    tone: "border-[#f2b8b5] bg-[#fff3f2] text-[#b3261e]",
    next: "Lịch đã bị hủy. Bạn có thể đặt lịch mới khi cần.",
  },
  CANCELLED_BY_DOCTOR: {
    label: "Bác sĩ đã hủy",
    tone: "border-[#f2b8b5] bg-[#fff3f2] text-[#b3261e]",
    next: "Lịch đã bị hủy bởi bác sĩ. Vui lòng đặt lại hoặc liên hệ bệnh viện.",
  },
  CANCELLED_BY_ADMIN: {
    label: "Bệnh viện đã hủy",
    tone: "border-[#f2b8b5] bg-[#fff3f2] text-[#b3261e]",
    next: "Lịch đã bị hủy bởi bệnh viện. Vui lòng liên hệ để được hỗ trợ.",
  },
  NO_SHOW: {
    label: "Không đến khám",
    tone: "border-[#f2b8b5] bg-[#fff3f2] text-[#b3261e]",
    next: "Lịch được ghi nhận là không đến khám.",
  },
};

const invoiceStatusLabels = {
  UNPAID: {
    label: "Chưa thanh toán",
    tone: "border-[#f4d48b] bg-[#fff8eb] text-[#8a5a00]",
  },
  PAID: {
    label: "Đã thanh toán",
    tone: "border-[#bde5c8] bg-[#f0fff4] text-[#1f7a3a]",
  },
  CANCELLED: {
    label: "Đã hủy",
    tone: "border-[#d8e2ef] bg-[#f8fafc] text-[#42526b]",
  },
  REFUNDED: {
    label: "Đã hoàn tiền",
    tone: "border-[#cfe4fa] bg-[#f3f8ff] text-[#0d4f8b]",
  },
} satisfies Record<
  PublicAppointmentInvoice["status"],
  { label: string; tone: string }
>;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatDate = (value: string) => formatVietnamDate(value);

const formatDateTime = (value: string) => formatVietnamDateTime(value);

const formatTime = (value: string) => value.slice(0, 5);

const doctorName = (appointment: DisplayAppointment) =>
  [appointment.doctor.title, appointment.doctor.user.fullName]
    .filter(Boolean)
    .join(" ");

const cancellableStatuses: AppointmentStatus[] = [
  "PENDING_CONFIRM",
  "CONFIRMED",
];

const getInitialQueryValue = (key: string) => {
  if (typeof window === "undefined") return "";

  return new URLSearchParams(window.location.search).get(key) || "";
};

const getInitialLookupValue = (key: "bookingCode" | "phone") => {
  const queryValue = getInitialQueryValue(key);
  if (queryValue) return queryValue;

  const lookupDraft = getPublicLookupDraft();
  const oneDay = 24 * 60 * 60 * 1000;
  if (!lookupDraft || Date.now() - lookupDraft.savedAt > oneDay) return "";

  return key === "bookingCode" ? lookupDraft.bookingCode : lookupDraft.phone;
};

const copyText = async (value: string) => {
  await navigator.clipboard.writeText(value).catch(() => undefined);
};

const scrollToElement = (
  element: HTMLElement | null,
  block: ScrollLogicalPosition = "center",
) => {
  window.setTimeout(() => {
    element?.scrollIntoView({ behavior: "smooth", block });
  }, 50);
};

const scrollToRef = (
  ref: { current: HTMLElement | null },
  block: ScrollLogicalPosition = "center",
) => {
  window.setTimeout(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block });
  }, 50);
};

export default function AppointmentLookupPage() {
  const [activeTab, setActiveTab] = useState<"CODE" | "FORGOT">("CODE");
  const [bookingCode, setBookingCode] = useState(() =>
    getInitialLookupValue("bookingCode"),
  );
  const [phone, setPhone] = useState(() => getInitialLookupValue("phone"));
  const [forgotPhone, setForgotPhone] = useState(() =>
    getInitialLookupValue("phone"),
  );
  const [otp, setOtp] = useState("");
  const [codeOtp, setCodeOtp] = useState("");
  const [appointment, setAppointment] = useState<DisplayAppointment | null>(
    null,
  );
  const [forgotItems, setForgotItems] = useState<DisplayAppointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [codeOtpSent, setCodeOtpSent] = useState(false);
  const [debugLookupOtp, setDebugLookupOtp] = useState("");
  const [debugCodeLookupOtp, setDebugCodeLookupOtp] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const lookupOtpRef = useRef<HTMLDivElement | null>(null);
  const codeLookupOtpRef = useRef<HTMLDivElement | null>(null);
  const lookupNoticeRef = useRef<HTMLDivElement | null>(null);
  const recentListRef = useRef<HTMLDivElement | null>(null);
  const resultPanelRef = useRef<HTMLDivElement | null>(null);

  const status = useMemo(
    () => (appointment ? statusLabels[appointment.status] : null),
    [appointment],
  );

  const resetFeedback = () => {
    setError("");
    setMessage("");
  };

  const requestCodeLookupOtp = async () => {
    resetFeedback();
    setAppointment(null);

    if (!bookingCode.trim()) {
      setError("Vui lòng nhập mã lịch hẹn.");
      scrollToRef(lookupNoticeRef);
      return;
    }

    if (!phone.trim()) {
      setError("Vui lòng nhập số điện thoại đã đặt lịch.");
      scrollToRef(lookupNoticeRef);
      return;
    }

    setLoading(true);

    try {
      const result = await apiRequest<{ debugOtp?: string }>(
        "/appointments/lookup/request-otp",
        {
          method: "POST",
          body: {
            bookingCode: bookingCode.trim().toUpperCase(),
            phone: phone.trim(),
          },
        },
      );
      setCodeOtpSent(true);
      setDebugCodeLookupOtp(result.debugOtp || "");
      setMessage(
        "OTP tra cứu lịch hẹn đã được gửi. Nhập mã để xem thông tin lịch.",
      );
      scrollToRef(codeLookupOtpRef);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không gửi được OTP tra cứu",
      );
      scrollToRef(lookupNoticeRef);
    } finally {
      setLoading(false);
    }
  };

  const requestLookupOtp = async () => {
    resetFeedback();
    setForgotItems([]);
    setAppointment(null);

    if (!forgotPhone.trim()) {
      setError("Vui lòng nhập số điện thoại đã đặt lịch.");
      scrollToRef(lookupNoticeRef);
      return;
    }

    setLoading(true);

    try {
      const result = await apiRequest<{ debugOtp?: string }>(
        "/appointments/lookup/request-otp",
        {
          method: "POST",
          body: { phone: forgotPhone.trim() },
        },
      );
      setOtpSent(true);
      setDebugLookupOtp(result.debugOtp || "");
      setMessage("OTP tra cứu lịch hẹn đã được gửi.");
      scrollToRef(lookupOtpRef);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không gửi được OTP tra cứu",
      );
      scrollToRef(lookupNoticeRef);
    } finally {
      setLoading(false);
    }
  };

  const verifyCodeLookupOtp = async () => {
    resetFeedback();
    setAppointment(null);

    if (!/^[0-9]{6}$/.test(codeOtp)) {
      setError("OTP phải gồm đúng 6 chữ số.");
      scrollToRef(lookupNoticeRef);
      return;
    }

    setLoading(true);
    try {
      const result = await apiRequest<LookupOtpResponse>(
        "/appointments/lookup/verify-otp",
        {
          method: "POST",
          body: {
            bookingCode: bookingCode.trim().toUpperCase(),
            phone: phone.trim(),
            otp: codeOtp,
          },
        },
      );
      const matchedAppointment = result.items[0] || null;
      setAppointment(matchedAppointment);
      setMessage(
        matchedAppointment
          ? "Đã xác thực OTP và tải thông tin lịch hẹn."
          : "Không tìm thấy lịch hẹn phù hợp.",
      );
      scrollToRef(matchedAppointment ? resultPanelRef : lookupNoticeRef);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Xác thực OTP tra cứu thất bại",
      );
      scrollToRef(lookupNoticeRef);
    } finally {
      setLoading(false);
    }
  };

  const verifyLookupOtp = async () => {
    resetFeedback();
    setForgotItems([]);
    setAppointment(null);

    if (!/^[0-9]{6}$/.test(otp)) {
      setError("OTP phải gồm đúng 6 chữ số.");
      scrollToRef(lookupNoticeRef);
      return;
    }

    setLoading(true);

    try {
      const result = await apiRequest<LookupOtpResponse>(
        "/appointments/lookup/verify-otp",
        {
          method: "POST",
          body: {
            phone: forgotPhone.trim(),
            otp,
          },
        },
      );

      setForgotItems(result.items);
      setAppointment(result.items[0] || null);
      setMessage(
        result.items.length
          ? "Đã xác thực OTP và tải danh sách lịch gần đây."
          : "Đã xác thực OTP nhưng chưa có lịch hẹn.",
      );
      scrollToRef(result.items.length ? recentListRef : lookupNoticeRef);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Xác thực OTP tra cứu thất bại",
      );
      scrollToRef(lookupNoticeRef);
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (tab: "CODE" | "FORGOT") => {
    setActiveTab(tab);
    resetFeedback();
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f4f9ff_0%,#f6f8fb_42%,#ffffff_100%)] text-[#172033]">
      <PublicPageHeader />
      <PublicPageHero
        eyebrow="Tra cứu lịch hẹn"
        title="Kiểm tra trạng thái lịch khám của bạn"
        description="Để bảo vệ thông tin khám, mọi hình thức tra cứu đều cần xác thực OTP. Nếu quên mã, hãy xác thực bằng số điện thoại để xem các lịch gần đây."
      />

      <section className="ui-container grid gap-6 py-8 sm:py-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(380px,1fr)]">
        <div className="h-fit rounded-xl border border-[#cfe0f3] bg-white/95 p-4 shadow-[0_18px_48px_rgba(13,79,139,0.10)] ring-1 ring-[#e7f0fb] sm:p-5">
          <div className="grid grid-cols-2 rounded-lg border border-[#d8e9ff] bg-[#eef6ff] p-1">
            <button
              type="button"
              onClick={() => switchTab("CODE")}
              className={`rounded-md px-3 py-2.5 text-sm font-semibold transition ${activeTab === "CODE" ? "bg-white text-[#0d4f8b] shadow-sm ring-1 ring-[#d8e9ff]" : "text-[#667892] hover:text-[#0d4f8b]"}`}
            >
              Có mã lịch
            </button>
            <button
              type="button"
              onClick={() => switchTab("FORGOT")}
              className={`rounded-md px-3 py-2.5 text-sm font-semibold transition ${activeTab === "FORGOT" ? "bg-white text-[#0d4f8b] shadow-sm ring-1 ring-[#d8e9ff]" : "text-[#667892] hover:text-[#0d4f8b]"}`}
            >
              Quên mã lịch
            </button>
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-lg border border-[#b8d7f4] bg-[#eef7ff] px-3 py-3 text-sm leading-6 text-[#0d4f8b]">
            <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white text-[#0d4f8b] shadow-sm">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            </span>
            <p>
              Mã lịch và số điện thoại chỉ dùng để gửi OTP. Sau khi xác thực,
              hệ thống mới hiển thị chi tiết lịch, kết quả khám hoặc thanh toán.
            </p>
          </div>

          {activeTab === "CODE" ? (
            <div className="mt-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#172033]">
                <Search className="h-4 w-4 text-[#0d4f8b]" />
                Thông tin tra cứu
              </div>
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="text-sm font-medium text-[#334155]">
                    Mã lịch hẹn
                  </span>
                  <input
                    value={bookingCode}
                    onChange={(event) =>
                      setBookingCode(event.target.value.toUpperCase())
                    }
                    placeholder="VD: HB202606030001"
                    className="ui-field mt-1 w-full px-3 py-3 text-sm uppercase"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-[#334155]">
                    Số điện thoại
                  </span>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="0901234567"
                    className="ui-field mt-1 w-full px-3 py-3 text-sm"
                  />
                </label>
                {codeOtpSent ? (
                  <div
                    ref={codeLookupOtpRef}
                    className="scroll-mt-24 space-y-3 rounded-lg border border-[#cfe4fa] bg-[#f8fbff] p-3 shadow-sm"
                  >
                    <DebugOtpBox otp={debugCodeLookupOtp} onFill={setCodeOtp} />
                    <label className="block">
                      <span className="text-sm font-medium text-[#334155]">
                        Mã OTP
                      </span>
                      <input
                        value={codeOtp}
                        onChange={(event) =>
                          setCodeOtp(
                            event.target.value.replace(/\D/g, "").slice(0, 6),
                          )
                        }
                        inputMode="numeric"
                        placeholder="000000"
                        className="ui-field mt-1 w-full bg-white px-3 py-3 text-center text-xl font-semibold tracking-[0.25em]"
                      />
                    </label>
                  </div>
                ) : null}
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void requestCodeLookupOtp()}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-[#cfd8e6] bg-white px-4 py-3 text-sm font-semibold text-[#42526b] transition hover:-translate-y-0.5 hover:bg-[#f8fafc] disabled:translate-y-0 disabled:opacity-60"
                >
                  {loading && !codeOtpSent ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Phone className="h-4 w-4" />
                  )}
                  {codeOtpSent ? "Gửi lại OTP" : "Gửi OTP"}
                </button>
                <button
                  type="button"
                  onClick={() => void verifyCodeLookupOtp()}
                  disabled={loading || !codeOtpSent}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-[#0d4f8b] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(13,79,139,0.18)] transition hover:-translate-y-0.5 hover:bg-[#083d6d] disabled:translate-y-0 disabled:opacity-60"
                >
                  {loading && codeOtpSent ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Xác thực và tra cứu
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#172033]">
                <ShieldCheck className="h-4 w-4 text-[#0d4f8b]" />
                Xác thực số điện thoại
              </div>
              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="text-sm font-medium text-[#334155]">
                    Số điện thoại đã đặt lịch
                  </span>
                  <input
                    value={forgotPhone}
                    onChange={(event) => setForgotPhone(event.target.value)}
                    placeholder="0901234567"
                    className="ui-field mt-1 w-full px-3 py-3 text-sm"
                  />
                </label>
                {otpSent ? (
                  <div ref={lookupOtpRef} className="scroll-mt-24 space-y-3 rounded-lg border border-[#cfe4fa] bg-[#f8fbff] p-3 shadow-sm">
                    <DebugOtpBox otp={debugLookupOtp} onFill={setOtp} />
                    <label className="block">
                      <span className="text-sm font-medium text-[#334155]">
                        Mã OTP
                      </span>
                      <input
                        value={otp}
                        onChange={(event) =>
                          setOtp(
                            event.target.value.replace(/\D/g, "").slice(0, 6),
                          )
                        }
                        inputMode="numeric"
                        placeholder="000000"
                        className="ui-field mt-1 w-full px-3 py-3 text-center text-xl font-semibold tracking-[0.25em]"
                      />
                    </label>
                  </div>
                ) : null}
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void requestLookupOtp()}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-[#cfd8e6] bg-white px-4 py-3 text-sm font-semibold text-[#42526b] transition hover:-translate-y-0.5 hover:bg-[#f8fafc] disabled:translate-y-0 disabled:opacity-60"
                >
                  {loading && !otpSent ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Phone className="h-4 w-4" />
                  )}
                  {otpSent ? "Gửi lại OTP" : "Gửi OTP"}
                </button>
                <button
                  type="button"
                  onClick={() => void verifyLookupOtp()}
                  disabled={loading || !otpSent}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-[#0d4f8b] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(13,79,139,0.18)] transition hover:-translate-y-0.5 hover:bg-[#083d6d] disabled:translate-y-0 disabled:opacity-60"
                >
                  {loading && otpSent ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Xem lịch gần đây
                </button>
              </div>
            </div>
          )}

          {message ? (
            <div
              ref={lookupNoticeRef}
              className="mt-4 scroll-mt-24 rounded-lg border border-[#bde5c8] bg-[#f0fff4] px-3 py-2.5 text-sm font-medium text-[#1f7a3a] shadow-sm"
            >
              {message}
            </div>
          ) : null}
          {error ? (
            <div
              ref={lookupNoticeRef}
              className="mt-4 scroll-mt-24 rounded-lg border border-[#f2b8b5] bg-[#fff3f2] px-3 py-2.5 text-sm font-medium text-[#b3261e] shadow-sm"
            >
              {error}
            </div>
          ) : null}

          {forgotItems.length ? (
            <div
              ref={recentListRef}
              className="mt-5 scroll-mt-24 rounded-lg border border-[#e5ebf3] bg-[#f8fbff] p-4"
            >
              <p className="text-sm font-semibold text-[#172033]">
                Lịch gần đây
              </p>
              <div className="mt-3 space-y-2">
                {forgotItems.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => {
                      setAppointment(item);
                      scrollToElement(resultPanelRef.current);
                    }}
                    className={`w-full rounded-md border px-3 py-3 text-left transition ${
                      appointment?.id === item.id
                        ? "border-[#0d4f8b] bg-[#f3f8ff]"
                        : "border-[#e5ebf3] hover:border-[#0d4f8b]"
                    }`}
                  >
                    <span className="block text-sm font-semibold text-[#172033]">
                      {item.bookingCode}
                    </span>
                    <span className="mt-1 block text-xs text-[#667892]">
                      {formatDate(item.appointmentDate)} -{" "}
                      {formatTime(item.startTime)} - {formatTime(item.endTime)}{" "}
                      - {statusLabels[item.status].label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-5 rounded-lg border border-[#e5ebf3] bg-[#fbfdff] px-3 py-3 text-sm text-[#667892]">
            Chưa rõ quy trình?{" "}
            <Link
              href="/guide/booking"
              className="font-semibold text-[#0d4f8b]"
            >
              Xem hướng dẫn đặt lịch
            </Link>
          </div>
        </div>

        <div ref={resultPanelRef} className="scroll-mt-24">
          <AppointmentResult
            appointment={appointment}
            status={status}
            onAppointmentChange={setAppointment}
          />
        </div>
      </section>
    </main>
  );
}

function AppointmentResult({
  appointment,
  status,
  onAppointmentChange,
}: {
  appointment: DisplayAppointment | null;
  status: (typeof statusLabels)[AppointmentStatus] | null;
  onAppointmentChange: (appointment: DisplayAppointment) => void;
}) {
  if (!appointment || !status) {
    return (
      <div className="rounded-xl border border-[#cfe0f3] bg-white/95 p-5 shadow-[0_18px_48px_rgba(13,79,139,0.08)] ring-1 ring-[#e7f0fb]">
        <div className="flex min-h-80 flex-col items-center justify-center rounded-lg border border-dashed border-[#cfe0f3] bg-[#f8fbff] p-8 text-center">
          <CheckCircle2 className="h-10 w-10 text-[#0d4f8b]" />
          <h2 className="mt-4 text-lg font-semibold">
            Nhập thông tin để tra cứu
          </h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-[#667892]">
            Kết quả lịch hẹn sẽ hiển thị tại đây sau khi thông tin khớp với hệ
            thống.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#cfe0f3] bg-white/95 p-5 shadow-[0_18px_48px_rgba(13,79,139,0.08)] ring-1 ring-[#e7f0fb]">
      <div className="flex flex-col gap-3 border-b border-[#e5ebf3] pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-[#667892]">Mã lịch hẹn</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold">
              {appointment.bookingCode}
            </h2>
            <button
              type="button"
              onClick={() => void copyText(appointment.bookingCode)}
              className="inline-flex items-center gap-1 rounded-md border border-[#cfd8e6] px-2 py-1.5 text-xs font-semibold text-[#42526b] hover:bg-[#f8fafc]"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy
            </button>
          </div>
          <p className="mt-2 max-w-xl text-xs leading-5 text-[#667892]">
            Hãy lưu mã này để tra cứu, xác thực lại OTP, thanh toán, hủy lịch
            hoặc xem kết quả khám sau này.
          </p>
        </div>
        <span
          className={`inline-flex w-fit rounded-md border px-3 py-1.5 text-sm font-semibold ${status.tone}`}
        >
          {status.label}
        </span>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-lg border border-[#d8e9ff] bg-[#f8fbff] px-4 py-3 text-sm leading-6 text-[#42526b]">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#0d4f8b]" aria-hidden="true" />
        <p>{status.next}</p>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <InfoItem
          icon={<CalendarDays className="h-4 w-4" />}
          label="Ngày khám"
          value={formatDate(appointment.appointmentDate)}
        />
        <InfoItem
          icon={<Clock className="h-4 w-4" />}
          label="Khung giờ"
          value={`${formatTime(appointment.startTime)} - ${formatTime(appointment.endTime)}`}
        />
        <InfoItem
          icon={<Stethoscope className="h-4 w-4" />}
          label="Bác sĩ"
          value={doctorName(appointment)}
        />
        <InfoItem
          icon={<Phone className="h-4 w-4" />}
          label="Số điện thoại"
          value={appointment.patientPhone}
        />
      </div>

      <div className="mt-5 rounded-md border border-[#e5ebf3] bg-[#f8fafc] p-4">
        <p className="text-sm font-semibold text-[#172033]">Thông tin khám</p>
        <div className="mt-3 space-y-2 text-sm text-[#667892]">
          <p>
            Chuyên khoa:{" "}
            <span className="font-semibold text-[#172033]">
              {appointment.department.name}
            </span>
          </p>
          <p>
            Gói khám:{" "}
            <span className="font-semibold text-[#172033]">
              {appointment.package?.name || "Khám theo bác sĩ"}
            </span>
          </p>
          <p>
            Lý do khám:{" "}
            <span className="font-semibold text-[#172033]">
              {appointment.reason || "-"}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <PriceItem label="Giá dự kiến" value={appointment.estimatedPrice} />
        <PriceItem label="Phí dịch vụ" value={appointment.serviceFee} />
        <PriceItem
          label="Thành tiền"
          value={appointment.finalAmount}
          highlight
        />
      </div>

      {appointment.status === "PENDING_OTP" ? (
        <PendingOtpPanel
          appointment={appointment}
          onVerified={onAppointmentChange}
        />
      ) : null}
      {appointment.status === "COMPLETED" ? (
        <ReviewPanel key={appointment.id} appointment={appointment} />
      ) : null}
      <CancelAppointmentPanel appointment={appointment} />
      <PaymentPanel appointment={appointment} />
      <MedicalResultPanel appointment={appointment} />
    </div>
  );
}

function PendingOtpPanel({
  appointment,
  onVerified,
}: {
  appointment: DisplayAppointment;
  onVerified: (appointment: DisplayAppointment) => void;
}) {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpMessage, setOtpMessage] = useState("");
  const [otpError, setOtpError] = useState("");
  const [debugPendingOtp, setDebugPendingOtp] = useState("");
  const pendingOtpRef = useRef<HTMLDivElement | null>(null);
  const pendingOtpNoticeRef = useRef<HTMLDivElement | null>(null);

  const resetFeedback = () => {
    setOtpMessage("");
    setOtpError("");
  };

  const verifyPendingOtp = async () => {
    resetFeedback();

    if (!/^[0-9]{6}$/.test(otp)) {
      setOtpError("OTP phải gồm đúng 6 chữ số.");
      scrollToRef(pendingOtpNoticeRef);
      return;
    }

    setLoading(true);

    try {
      const result = await apiRequest<DisplayAppointment>(
        `/appointments/${appointment.id}/verify-otp`,
        {
          method: "POST",
          body: { otp },
        },
      );

      onVerified(result);
      setOtp("");
      setOtpMessage(
        "Xác thực OTP thành công. Lịch hẹn đang chờ bệnh viện xác nhận.",
      );
      scrollToRef(pendingOtpNoticeRef);
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Xác thực OTP thất bại");
      scrollToRef(pendingOtpNoticeRef);
    } finally {
      setLoading(false);
    }
  };

  const resendPendingOtp = async () => {
    resetFeedback();
    setLoading(true);

    try {
      const result = await apiRequest<{ debugOtp?: string }>(
        `/appointments/${appointment.id}/resend-otp`,
        {
          method: "POST",
        },
      );

      setDebugPendingOtp(result.debugOtp || "");
      setOtpMessage(
        "OTP đã được gửi lại. Vui lòng kiểm tra tin nhắn hoặc email.",
      );
      scrollToRef(pendingOtpNoticeRef);
    } catch (err) {
      setOtpError(
        err instanceof Error ? err.message : "Không gửi lại được OTP",
      );
      scrollToRef(pendingOtpNoticeRef);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={pendingOtpRef}
      className="mt-5 scroll-mt-24 rounded-md border border-[#cfe4fa] bg-[#f3f8ff] p-4"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-[#0d4f8b]">
        <ShieldCheck className="h-4 w-4" />
        Xác thực lại OTP
      </div>
      <p className="mt-2 text-sm leading-6 text-[#42526b]">
        Lịch này đã được tạo nhưng chưa xác thực OTP. Bạn có thể nhập OTP tại
        đây hoặc gửi lại OTP để hoàn tất đặt lịch.
      </p>
      <input
        value={otp}
        onChange={(event) =>
          setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
        }
        inputMode="numeric"
        placeholder="000000"
        className="mt-3 w-full rounded-md border border-[#cfd8e6] bg-white px-3 py-2.5 text-center text-xl font-semibold tracking-[0.25em] outline-none focus:border-[#0d4f8b]"
      />
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => void verifyPendingOtp()}
          disabled={loading || otp.length !== 6}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-[#0d4f8b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#083d6d] disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Xác nhận OTP
        </button>
        <button
          type="button"
          onClick={() => void resendPendingOtp()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-[#cfd8e6] bg-white px-4 py-2.5 text-sm font-semibold text-[#42526b] hover:bg-[#f8fafc] disabled:opacity-60"
        >
          <Phone className="h-4 w-4" />
          Gửi lại OTP
        </button>
      </div>
      <div ref={pendingOtpNoticeRef} className="scroll-mt-24">
        <DebugOtpBox otp={debugPendingOtp} onFill={setOtp} className="mt-3" />
        {otpMessage ? (
          <div className="mt-3 rounded-md border border-[#bde5c8] bg-[#f0fff4] px-3 py-2 text-sm font-medium text-[#1f7a3a]">
            {otpMessage}
          </div>
        ) : null}
        {otpError ? (
          <div className="mt-3 rounded-md border border-[#f2b8b5] bg-[#fff3f2] px-3 py-2 text-sm font-medium text-[#b3261e]">
            {otpError}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CancelAppointmentPanel({
  appointment,
}: {
  appointment: DisplayAppointment;
}) {
  const [reason, setReason] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [debugCancelOtp, setDebugCancelOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [cancelMessage, setCancelMessage] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [cancelled, setCancelled] = useState(
    appointment.status === "CANCELLED_BY_PATIENT",
  );
  const cancelPanelRef = useRef<HTMLDivElement | null>(null);
  const cancelOtpRef = useRef<HTMLDivElement | null>(null);
  const cancelNoticeRef = useRef<HTMLDivElement | null>(null);

  const canCancel =
    cancellableStatuses.includes(appointment.status) && !cancelled;

  const resetFeedback = () => {
    setCancelMessage("");
    setCancelError("");
  };

  const requestCancelOtp = async () => {
    resetFeedback();
    setDebugCancelOtp("");

    if (reason.trim().length < 2) {
      setCancelError("Vui lòng nhập lý do hủy tối thiểu 2 ký tự.");
      scrollToRef(cancelNoticeRef);
      return;
    }

    setLoading(true);

    try {
      const result = await apiRequest<{ debugOtp?: string }>(
        "/appointments/lookup/cancel/request-otp",
        {
          method: "POST",
          body: {
            bookingCode: appointment.bookingCode,
            phone: appointment.patientPhone,
            reason: reason.trim(),
          },
        },
      );

      setOtpSent(true);
      setDebugCancelOtp(result.debugOtp || "");
      setCancelMessage("OTP xác nhận hủy lịch đã được gửi.");
      scrollToRef(cancelOtpRef);
    } catch (err) {
      setCancelError(
        err instanceof Error ? err.message : "Không gửi được OTP hủy lịch",
      );
      scrollToRef(cancelNoticeRef);
    } finally {
      setLoading(false);
    }
  };

  const verifyCancel = async () => {
    resetFeedback();

    if (!/^[0-9]{6}$/.test(otp)) {
      setCancelError("OTP phải gồm đúng 6 chữ số.");
      scrollToRef(cancelNoticeRef);
      return;
    }

    setLoading(true);

    try {
      await apiRequest<DisplayAppointment>(
        "/appointments/lookup/cancel/verify",
        {
          method: "POST",
          body: {
            bookingCode: appointment.bookingCode,
            phone: appointment.patientPhone,
            reason: reason.trim(),
            otp,
          },
        },
      );

      setCancelled(true);
      setDebugCancelOtp("");
      setCancelMessage(
        "Đã hủy lịch hẹn thành công. Khung giờ có thể được mở lại cho người khác.",
      );
      scrollToRef(cancelNoticeRef);
    } catch (err) {
      setCancelError(
        err instanceof Error
          ? err.message
          : "Không xác thực được yêu cầu hủy lịch",
      );
      scrollToRef(cancelNoticeRef);
    } finally {
      setLoading(false);
    }
  };

  if (!canCancel && !cancelled) {
    return (
      <div className="mt-5 rounded-md border border-[#e5ebf3] bg-[#f8fafc] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#172033]">
          <ShieldCheck className="h-4 w-4 text-[#0d4f8b]" />
          Hủy lịch hẹn
        </div>
        <p className="mt-2 text-sm leading-6 text-[#667892]">
          Lịch hẹn hiện không còn ở trạng thái có thể hủy trực tuyến. Vui lòng
          liên hệ bệnh viện nếu cần hỗ trợ.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={cancelPanelRef}
      className="mt-5 scroll-mt-24 rounded-md border border-[#f4d48b] bg-[#fff8eb] p-4"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-[#8a5a00]">
        <ShieldCheck className="h-4 w-4" />
        Hủy lịch hẹn
      </div>
      {cancelled ? (
        <p className="mt-2 text-sm leading-6 text-[#8a5a00]">
          Lịch hẹn đã được hủy bởi người bệnh.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm leading-6 text-[#667892]">
            Bạn có thể hủy lịch đang chờ xác nhận hoặc đã xác nhận. Sau khi hủy,
            khung giờ có thể được mở lại cho người khác.
          </p>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="Nhập lý do hủy lịch"
            className="mt-3 w-full rounded-md border border-[#f4d48b] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#0d4f8b]"
          />
          {otpSent ? (
            <div ref={cancelOtpRef} className="scroll-mt-24">
              <DebugOtpBox
                otp={debugCancelOtp}
                onFill={setOtp}
                className="mt-3"
              />
              <input
                value={otp}
                onChange={(event) =>
                  setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                placeholder="000000"
                className="mt-3 w-full rounded-md border border-[#f4d48b] bg-white px-3 py-2.5 text-center text-xl font-semibold tracking-[0.25em] outline-none focus:border-[#0d4f8b]"
              />
            </div>
          ) : null}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void requestCancelOtp()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-[#d9a441] bg-white px-4 py-2.5 text-sm font-semibold text-[#8a5a00] hover:bg-[#fff4d6] disabled:opacity-60"
            >
              {loading && !otpSent ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Phone className="h-4 w-4" />
              )}
              {otpSent ? "Gửi lại OTP" : "Gửi OTP hủy lịch"}
            </button>
            <button
              type="button"
              onClick={() => void verifyCancel()}
              disabled={loading || !otpSent}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#b3261e] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#8f1d17] disabled:opacity-60"
            >
              {loading && otpSent ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Xác nhận hủy lịch
            </button>
          </div>
        </>
      )}
      <div ref={cancelNoticeRef} className="scroll-mt-24">
        {cancelMessage ? (
          <div className="mt-3 rounded-md border border-[#bde5c8] bg-[#f0fff4] px-3 py-2 text-sm font-medium text-[#1f7a3a]">
            {cancelMessage}
          </div>
        ) : null}
        {cancelError ? (
          <div className="mt-3 rounded-md border border-[#f2b8b5] bg-[#fff3f2] px-3 py-2 text-sm font-medium text-[#b3261e]">
            {cancelError}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type AppointmentReview = {
  id: string;
  rating: number;
  doctorRating: number;
  serviceRating: number;
  facilityRating: number;
  comment: string | null;
  createdAt: string;
};

function RatingInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[#e5ebf3] bg-white px-3 py-3">
      <span className="text-sm font-medium text-[#334155]">{label}</span>
      <div
        className="flex items-center gap-1"
        role="radiogroup"
        aria-label={label}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={value === star}
            aria-label={`${star} sao`}
            onClick={() => onChange(star)}
            className="rounded p-1 text-[#d5a13b] transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-[#0d4f8b]"
          >
            <Star
              className={`h-5 w-5 ${star <= value ? "fill-current" : "text-[#cfd8e6]"}`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function RatingSummary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[#e5ebf3] bg-[#f8fafc] px-3 py-2">
      <p className="text-xs font-medium text-[#667892]">{label}</p>
      <div className="mt-1 flex items-center gap-0.5 text-[#d5a13b]">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-3.5 w-3.5 ${star <= value ? "fill-current" : "text-[#cfd8e6]"}`}
          />
        ))}
        <span className="ml-1 text-xs font-semibold text-[#42526b]">
          {value}/5
        </span>
      </div>
    </div>
  );
}

function ReviewPanel({ appointment }: { appointment: DisplayAppointment }) {
  const [existingReview, setExistingReview] =
    useState<AppointmentReview | null>(null);
  const [doctorRating, setDoctorRating] = useState(0);
  const [serviceRating, setServiceRating] = useState(0);
  const [facilityRating, setFacilityRating] = useState(0);
  const [comment, setComment] = useState("");
  const [otp, setOtp] = useState("");
  const [debugOtp, setDebugOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const reviewOtpRef = useRef<HTMLDivElement | null>(null);
  const reviewNoticeRef = useRef<HTMLDivElement | null>(null);

  const identity = useMemo(
    () => ({
      bookingCode: appointment.bookingCode,
      phone: appointment.patientPhone,
    }),
    [appointment.bookingCode, appointment.patientPhone],
  );

  useEffect(() => {
    let active = true;
    const loadReview = async () => {
      setLoading(true);
      try {
        const review = await apiRequest<AppointmentReview | null>(
          `/appointments/${appointment.id}/review`,
          { query: identity },
        );
        if (active) setExistingReview(review);
      } catch (err) {
        if (active)
          setError(
            err instanceof Error ? err.message : "Không tải được đánh giá",
          );
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadReview();
    return () => {
      active = false;
    };
  }, [appointment.id, identity]);

  const requestOtp = async () => {
    setError("");
    setMessage("");
    if (!doctorRating || !serviceRating || !facilityRating) {
      setError("Vui lòng chọn đủ ba tiêu chí đánh giá trước khi nhận OTP.");
      scrollToRef(reviewNoticeRef);
      return;
    }
    setSubmitting(true);
    try {
      const result = await apiRequest<{
        debugOtp?: string;
        channel: "SMS" | "EMAIL";
        deliveryStatus: string;
      }>(`/appointments/${appointment.id}/review/request-otp`, {
        method: "POST",
        body: identity,
      });
      setDebugOtp(result.debugOtp || "");
      setOtpSent(true);
      setMessage(
        result.deliveryStatus === "FAILED"
          ? "Đánh giá đã sẵn sàng, nhưng hệ thống chưa gửi được OTP. Hãy thử gửi lại sau."
          : `OTP xác nhận đánh giá đã được gửi qua ${result.channel === "EMAIL" ? "email" : "SMS"}.`,
      );
      scrollToRef(reviewOtpRef);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không thể gửi OTP đánh giá",
      );
      scrollToRef(reviewNoticeRef);
    } finally {
      setSubmitting(false);
    }
  };

  const submitReview = async () => {
    setError("");
    setMessage("");
    if (!/^[0-9]{6}$/.test(otp)) {
      setError("Vui lòng nhập mã OTP gồm 6 chữ số.");
      scrollToRef(reviewNoticeRef);
      return;
    }
    setSubmitting(true);
    try {
      const review = await apiRequest<AppointmentReview>(
        `/appointments/${appointment.id}/review`,
        {
          method: "POST",
          body: {
            ...identity,
            otp,
            doctorRating,
            serviceRating,
            facilityRating,
            comment: comment.trim() || null,
          },
        },
      );
      setExistingReview(review);
      setMessage("Cảm ơn bạn đã chia sẻ trải nghiệm khám.");
      scrollToRef(reviewNoticeRef);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể gửi đánh giá");
      scrollToRef(reviewNoticeRef);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mt-6 rounded-md border border-[#b9d8ef] bg-[#f5fbff] p-5">
      <div className="flex items-start gap-3">
        <span className="rounded-md bg-[#e3f1fc] p-2 text-[#0d4f8b]">
          <Star className="h-5 w-5 fill-current" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-[#172033]">
            Đánh giá trải nghiệm khám
          </h2>
          <p className="mt-1 text-sm leading-6 text-[#52677f]">
            Phản hồi của bạn giúp bệnh viện cải thiện chất lượng phục vụ.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-[#667892]">
          Đang kiểm tra đánh giá của bạn...
        </p>
      ) : null}
      {!loading && existingReview ? (
        <div className="mt-4 rounded-md border border-[#bde5c8] bg-white p-4 text-sm text-[#334155]">
          <p className="font-semibold text-[#1f7a3a]">
            Bạn đã gửi đánh giá. Cảm ơn bạn.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <RatingSummary label="Bác sĩ" value={existingReview.doctorRating} />
            <RatingSummary
              label="Dịch vụ"
              value={existingReview.serviceRating}
            />
            <RatingSummary
              label="Cơ sở vật chất"
              value={existingReview.facilityRating}
            />
          </div>
          {existingReview.comment ? (
            <p className="mt-3 border-t border-[#e5ebf3] pt-3 italic">
              “{existingReview.comment}”
            </p>
          ) : null}
        </div>
      ) : null}
      {!loading && !existingReview ? (
        <div className="mt-4 space-y-3">
          <RatingInput
            label="Bác sĩ"
            value={doctorRating}
            onChange={setDoctorRating}
          />
          <RatingInput
            label="Tiếp đón và dịch vụ"
            value={serviceRating}
            onChange={setServiceRating}
          />
          <RatingInput
            label="Cơ sở vật chất"
            value={facilityRating}
            onChange={setFacilityRating}
          />
          <label className="block">
            <span className="text-sm font-medium text-[#334155]">
              Chia sẻ thêm (không bắt buộc)
            </span>
            <textarea
              value={comment}
              onChange={(event) =>
                setComment(event.target.value.slice(0, 1000))
              }
              maxLength={1000}
              rows={3}
              placeholder="Điều gì khiến bạn hài lòng hoặc cần cải thiện?"
              className="mt-1 w-full resize-y rounded-md border border-[#cfd8e6] bg-white px-3 py-2 text-sm outline-none focus:border-[#0d4f8b]"
            />
          </label>
          {otpSent ? (
            <div
              ref={reviewOtpRef}
              className="scroll-mt-24 rounded-md border border-[#cfe4fa] bg-white p-3"
            >
              <DebugOtpBox otp={debugOtp} onFill={setOtp} />
              <input
                value={otp}
                onChange={(event) =>
                  setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputMode="numeric"
                placeholder="Nhập OTP 6 chữ số"
                className="mt-3 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-center text-lg font-semibold tracking-[0.2em] outline-none focus:border-[#0d4f8b]"
              />
            </div>
          ) : null}
          <div ref={reviewNoticeRef} className="scroll-mt-24">
            {error ? (
              <p className="rounded-md border border-[#f2b8b5] bg-[#fff3f2] px-3 py-2 text-sm text-[#b3261e]">
                {error}
              </p>
            ) : null}
            {message ? (
              <p className="rounded-md border border-[#bde5c8] bg-[#f0fff4] px-3 py-2 text-sm text-[#1f7a3a]">
                {message}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void (otpSent ? submitReview() : requestOtp())}
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#0d4f8b] px-4 py-3 text-sm font-semibold text-white hover:bg-[#083d6d] disabled:opacity-60"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            {otpSent ? "Xác nhận gửi đánh giá" : "Nhận OTP để gửi đánh giá"}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function MedicalResultPanel({
  appointment,
}: {
  appointment: DisplayAppointment;
}) {
  const [result, setResult] = useState<PublicAppointmentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultError, setResultError] = useState("");

  useEffect(() => {
    let active = true;

    const loadResult = async () => {
      setLoading(true);
      setResultError("");

      try {
        const data = await apiRequest<PublicAppointmentResult>(
          "/appointments/lookup/result",
          {
            query: {
              bookingCode: appointment.bookingCode,
              phone: appointment.patientPhone,
            },
          },
        );

        if (active) setResult(data);
      } catch (err) {
        if (active) {
          setResult(null);
          setResultError(
            err instanceof Error ? err.message : "Không tải được kết quả khám",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadResult();

    return () => {
      active = false;
    };
  }, [appointment.bookingCode, appointment.patientPhone]);

  const medicalRecord = result?.medicalRecord || null;
  const prescription = result?.prescription || null;

  return (
    <div className="mt-5 rounded-md border border-[#dce3ee] bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[#172033]">
            <ClipboardList className="h-4 w-4 text-[#0d4f8b]" />
            Kết quả khám
          </div>
          <p className="mt-2 text-sm leading-6 text-[#667892]">
            Kết quả chỉ hiển thị khi bác sĩ đã công bố hồ sơ và phát hành đơn
            thuốc.
          </p>
        </div>
        {medicalRecord?.publishedAt ? (
          <span className="inline-flex w-fit rounded-md border border-[#bde5c8] bg-[#f0fff4] px-3 py-1.5 text-sm font-semibold text-[#1f7a3a]">
            Đã công bố
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <span key={index} className="skeleton-shimmer h-24 rounded-md" />
          ))}
        </div>
      ) : resultError ? (
        <div className="mt-4 rounded-md border border-[#f2b8b5] bg-[#fff3f2] px-3 py-2 text-sm font-medium text-[#b3261e]">
          {resultError}
        </div>
      ) : !medicalRecord ? (
        <div className="mt-5 rounded-md border border-dashed border-[#dce3ee] bg-[#f8fafc] p-6 text-center">
          <FileText className="mx-auto h-9 w-9 text-[#0d4f8b]" />
          <h3 className="mt-3 font-semibold">Chưa có kết quả được công bố</h3>
          <p className="mt-2 text-sm leading-6 text-[#667892]">
            Nếu lịch khám đã hoàn tất, vui lòng chờ bác sĩ công bố hồ sơ hoặc
            liên hệ bệnh viện để được hỗ trợ.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 rounded-md border border-[#e5ebf3] bg-[#f8fafc] p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#667892]">
                  Mã hồ sơ
                </p>
                <h3 className="mt-1 text-xl font-semibold text-[#172033]">
                  {medicalRecord.recordCode}
                </h3>
              </div>
              {medicalRecord.resultPdfUrl ? (
                <a
                  href={medicalRecord.resultPdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-[#cfd8e6] px-3 py-2 text-sm font-semibold text-[#42526b] hover:bg-white"
                >
                  File kết quả
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <ResultText label="Triệu chứng" value={medicalRecord.symptoms} />
              <ResultText label="Chẩn đoán" value={medicalRecord.diagnosis} />
              <ResultText label="Điều trị" value={medicalRecord.treatment} />
              <ResultText
                label="Lời dặn bác sĩ"
                value={medicalRecord.doctorNotes}
              />
            </div>
            {medicalRecord.prescription ? (
              <div className="mt-3 rounded-md bg-white px-3 py-2 text-sm leading-6 text-[#42526b]">
                <span className="font-semibold text-[#172033]">
                  Ghi chú kê toa:{" "}
                </span>
                {medicalRecord.prescription}
              </div>
            ) : null}
          </div>

          <LabResultsSection labResults={medicalRecord.labResults} />
          <PrescriptionSection prescription={prescription} />
        </>
      )}
    </div>
  );
}

function ResultText({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-md border border-[#e5ebf3] bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#667892]">
        {label}
      </p>
      <p className="mt-2 text-sm leading-6 text-[#172033]">
        {value || "Chưa cập nhật"}
      </p>
    </div>
  );
}

function LabResultsSection({ labResults }: { labResults: LabResult[] }) {
  return (
    <div className="mt-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-[#172033]">
        <FlaskConical className="h-4 w-4 text-[#0d4f8b]" />
        Kết quả lâm sàng
      </div>
      {labResults.length ? (
        <div className="mt-3 grid gap-3">
          {labResults.map((item) => (
            <div
              key={item.id}
              className="rounded-md border border-[#e5ebf3] bg-[#f8fafc] p-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h4 className="font-semibold text-[#172033]">
                    {item.testName}
                  </h4>
                  <p className="mt-1 text-sm text-[#667892]">
                    {item.resultValue || "-"} {item.unit || ""}
                    {item.referenceRange
                      ? ` · Tham chiếu: ${item.referenceRange}`
                      : ""}
                  </p>
                </div>
                {item.fileUrl ? (
                  <a
                    href={item.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-semibold text-[#0d4f8b]"
                  >
                    Xem file
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
              </div>
              {item.conclusion ? (
                <p className="mt-3 text-sm leading-6 text-[#42526b]">
                  {item.conclusion}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-dashed border-[#dce3ee] bg-[#f8fafc] px-4 py-3 text-sm text-[#667892]">
          Chưa có kết quả lâm sàng được công bố.
        </p>
      )}
    </div>
  );
}

function PrescriptionSection({
  prescription,
}: {
  prescription: PublicAppointmentResult["prescription"];
}) {
  return (
    <div className="mt-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-[#172033]">
        <Pill className="h-4 w-4 text-[#0d4f8b]" />
        Đơn thuốc
      </div>
      {prescription ? (
        <div className="mt-3 rounded-md border border-[#e5ebf3] bg-[#f8fafc] p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#667892]">
                Mã đơn thuốc
              </p>
              <h4 className="mt-1 font-semibold text-[#172033]">
                {prescription.prescriptionCode}
              </h4>
            </div>
            <span className="inline-flex w-fit rounded-md border border-[#bde5c8] bg-[#f0fff4] px-3 py-1.5 text-sm font-semibold text-[#1f7a3a]">
              Đã phát hành
            </span>
          </div>
          {prescription.note ? (
            <p className="mt-3 text-sm leading-6 text-[#42526b]">
              {prescription.note}
            </p>
          ) : null}
          <div className="mt-4 space-y-2">
            {prescription.items.map((item) => (
              <div key={item.id} className="rounded-md bg-white p-3 text-sm">
                <p className="font-semibold text-[#172033]">
                  {item.medicineName}
                </p>
                <p className="mt-1 text-[#667892]">
                  {[item.dosage, item.frequency, item.duration]
                    .filter(Boolean)
                    .join(" · ") || "Chưa cập nhật liều dùng"}
                  {item.quantity
                    ? ` · SL: ${item.quantity}${item.unit ? ` ${item.unit}` : ""}`
                    : ""}
                </p>
                {item.instruction ? (
                  <p className="mt-1 text-[#42526b]">{item.instruction}</p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-dashed border-[#dce3ee] bg-[#f8fafc] px-4 py-3 text-sm text-[#667892]">
          Chưa có đơn thuốc được phát hành.
        </p>
      )}
    </div>
  );
}

function PaymentPanel({ appointment }: { appointment: DisplayAppointment }) {
  const latestPendingTransaction =
    appointment.invoice?.paymentTransactions.find(
      (item) => item.status === "PENDING",
    ) || null;
  const [provider, setProvider] =
    useState<Extract<PaymentProvider, "MOCK" | "MOMO">>("MOCK");
  const [transaction, setTransaction] = useState<PaymentTransaction | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentError, setPaymentError] = useState("");

  const activeTransaction = transaction || latestPendingTransaction;
  const invoice = transaction?.invoice || appointment.invoice;
  const invoiceStatus = invoice ? invoiceStatusLabels[invoice.status] : null;
  const canCreatePayment = invoice?.status === "UNPAID";

  const refreshPayment = useCallback(
    async (silent = false) => {
      if (!activeTransaction) return;

      if (!silent) {
        setLoading(true);
        setPaymentMessage("");
        setPaymentError("");
      }

      try {
        const result = await apiRequest<PaymentTransaction>(
          `/payments/${activeTransaction.id}`,
        );

        setTransaction(result);

        if (!silent) {
          setPaymentMessage(
            result.status === "SUCCESS"
              ? "Thanh toán đã được ghi nhận thành công."
              : "Đã cập nhật trạng thái giao dịch.",
          );
        }
      } catch (err) {
        if (!silent) {
          setPaymentError(
            err instanceof Error
              ? err.message
              : "Không kiểm tra được trạng thái thanh toán",
          );
        }
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [activeTransaction],
  );

  useEffect(() => {
    if (
      !activeTransaction ||
      activeTransaction.status !== "PENDING" ||
      invoice?.status !== "UNPAID"
    )
      return undefined;

    const timer = window.setInterval(() => {
      void refreshPayment(true);
    }, 8000);

    return () => window.clearInterval(timer);
  }, [activeTransaction, invoice?.status, refreshPayment]);

  const createPayment = async () => {
    if (!appointment.invoice) return;

    setLoading(true);
    setPaymentMessage("");
    setPaymentError("");

    try {
      const result = await apiRequest<PaymentTransaction>(
        `/payments/invoices/${appointment.invoice.id}/create`,
        {
          method: "POST",
          body: { provider },
        },
      );

      setTransaction(result);
      setPaymentMessage(
        "Đã tạo giao dịch thanh toán. Bạn có thể mở cổng thanh toán để tiếp tục.",
      );

      if (result.paymentUrl) {
        window.open(result.paymentUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setPaymentError(
        err instanceof Error
          ? err.message
          : "Không tạo được giao dịch thanh toán",
      );
    } finally {
      setLoading(false);
    }
  };

  const markMockSuccess = async () => {
    if (!activeTransaction) return;

    setLoading(true);
    setPaymentMessage("");
    setPaymentError("");

    try {
      const result = await apiRequest<PaymentTransaction>(
        `/payments/mock/${activeTransaction.transactionCode}/success`,
        {
          method: "POST",
        },
      );

      setTransaction(result);
      setPaymentMessage("Đã giả lập thanh toán thành công.");
    } catch (err) {
      setPaymentError(
        err instanceof Error ? err.message : "Không thể giả lập thanh toán",
      );
    } finally {
      setLoading(false);
    }
  };

  const cancelPayment = async () => {
    if (!activeTransaction) return;

    setLoading(true);
    setPaymentMessage("");
    setPaymentError("");

    try {
      const result = await apiRequest<PaymentTransaction>(
        `/payments/${activeTransaction.id}/cancel`,
        {
          method: "PATCH",
        },
      );

      setTransaction(result);
      setPaymentMessage("Đã hủy giao dịch thanh toán đang chờ.");
    } catch (err) {
      setPaymentError(
        err instanceof Error
          ? err.message
          : "Không hủy được giao dịch thanh toán",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!appointment.invoice) {
    return (
      <div className="mt-5 rounded-md border border-[#dce3ee] bg-[#f8fafc] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#172033]">
          <CreditCard className="h-4 w-4 text-[#0d4f8b]" />
          Hóa đơn và thanh toán
        </div>
        <p className="mt-2 text-sm leading-6 text-[#667892]">
          Lịch hẹn chưa có hóa đơn. Hóa đơn sẽ xuất hiện tại đây sau khi bệnh
          viện hoàn tất quy trình khám và phát hành hóa đơn.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-md border border-[#dce3ee] bg-[#f8fafc] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[#172033]">
            <CreditCard className="h-4 w-4 text-[#0d4f8b]" />
            Hóa đơn và thanh toán
          </div>
          <p className="mt-2 text-sm text-[#667892]">
            Mã hóa đơn:{" "}
            <span className="font-semibold text-[#172033]">
              {appointment.invoice.invoiceCode}
            </span>
          </p>
        </div>
        {invoiceStatus ? (
          <span
            className={`inline-flex w-fit rounded-md border px-3 py-1.5 text-sm font-semibold ${invoiceStatus.tone}`}
          >
            {invoiceStatus.label}
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <PriceItem label="Tổng tiền" value={appointment.invoice.totalAmount} />
        <PriceItem
          label="Giảm trừ BHYT"
          value={appointment.invoice.bhytDiscount}
        />
        <PriceItem
          label="Cần thanh toán"
          value={invoice?.finalAmount || appointment.invoice.finalAmount}
          highlight
        />
      </div>

      {canCreatePayment ? (
        <div className="mt-4 rounded-md border border-[#e5ebf3] bg-white p-4">
          <p className="text-sm font-semibold text-[#172033]">
            Thanh toán online
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)]">
            <select
              value={provider}
              onChange={(event) =>
                setProvider(event.target.value as typeof provider)
              }
              className="rounded-md border border-[#cfd8e6] px-3 py-2.5 text-sm outline-none focus:border-[#0d4f8b]"
            >
              <option value="MOCK">MOCK</option>
              <option value="MOMO">MOMO</option>
            </select>
            <button
              type="button"
              onClick={() => void createPayment()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#0d4f8b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#083d6d] disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              Tạo giao dịch thanh toán
            </button>
          </div>

          {activeTransaction ? (
            <div className="mt-3 rounded-md bg-[#f8fafc] p-3 text-sm text-[#667892]">
              <div className="grid gap-2 sm:grid-cols-2">
                <p>
                  Mã giao dịch:{" "}
                  <span className="font-semibold text-[#172033]">
                    {activeTransaction.transactionCode}
                  </span>
                </p>
                <p>
                  Trạng thái:{" "}
                  <span className="font-semibold text-[#172033]">
                    {activeTransaction.status}
                  </span>
                </p>
                <p>
                  Số tiền:{" "}
                  <span className="font-semibold text-[#172033]">
                    {formatCurrency(activeTransaction.amount)}
                  </span>
                </p>
                <p>
                  Hạn thanh toán:{" "}
                  <span className="font-semibold text-[#172033]">
                    {formatDateTime(activeTransaction.expiredAt)}
                  </span>
                </p>
              </div>
              {activeTransaction.status === "PENDING" ? (
                <p className="mt-3 rounded-md bg-white px-3 py-2 text-xs leading-5 text-[#667892]">
                  Hệ thống sẽ tự kiểm tra trạng thái mỗi 8 giây khi giao dịch
                  còn đang chờ.
                </p>
              ) : null}
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={() => void refreshPayment()}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-[#cfd8e6] px-3 py-2 text-sm font-semibold text-[#42526b] hover:bg-white disabled:opacity-60"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Kiểm tra thanh toán
                </button>
                {activeTransaction.paymentUrl ? (
                  <a
                    href={activeTransaction.paymentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-[#cfd8e6] px-3 py-2 text-sm font-semibold text-[#42526b] hover:bg-white"
                  >
                    Mở cổng thanh toán
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
                {activeTransaction.status === "PENDING" ? (
                  <button
                    type="button"
                    onClick={() => void cancelPayment()}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-[#f2b8b5] px-3 py-2 text-sm font-semibold text-[#b3261e] hover:bg-[#fff3f2] disabled:opacity-60"
                  >
                    Hủy giao dịch
                  </button>
                ) : null}
                {activeTransaction.provider === "MOCK" &&
                activeTransaction.status === "PENDING" ? (
                  <button
                    type="button"
                    onClick={() => void markMockSuccess()}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-[#bde5c8] px-3 py-2 text-sm font-semibold text-[#1f7a3a] hover:bg-[#f0fff4] disabled:opacity-60"
                  >
                    Giả lập đã thanh toán
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 rounded-md bg-white px-3 py-2 text-sm leading-6 text-[#667892]">
          Hóa đơn hiện không ở trạng thái cần thanh toán online.
        </p>
      )}

      {paymentMessage ? (
        <div className="mt-3 rounded-md border border-[#bde5c8] bg-[#f0fff4] px-3 py-2 text-sm font-medium text-[#1f7a3a]">
          {paymentMessage}
        </div>
      ) : null}
      {paymentError ? (
        <div className="mt-3 rounded-md border border-[#f2b8b5] bg-[#fff3f2] px-3 py-2 text-sm font-medium text-[#b3261e]">
          {paymentError}
        </div>
      ) : null}
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-[#e5ebf3] p-4">
      <div className="flex items-center gap-2 text-sm text-[#667892]">
        {icon}
        {label}
      </div>
      <p className="mt-2 font-semibold text-[#172033]">{value}</p>
    </div>
  );
}

function PriceItem({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-4 ${highlight ? "border-[#cfe4fa] bg-[#f3f8ff]" : "border-[#e5ebf3] bg-white"}`}
    >
      <p className="text-xs text-[#667892]">{label}</p>
      <p
        className={`mt-2 text-lg font-semibold ${highlight ? "text-[#0d4f8b]" : "text-[#172033]"}`}
      >
        {formatCurrency(value)}
      </p>
    </div>
  );
}
