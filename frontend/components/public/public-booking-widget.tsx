"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Delete,
  Info,
  Loader2,
  Phone,
  Send,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import {
  formatVietnamDate,
  getVietnamDateInput,
  getVietnamTimeInput,
  getVietnamYesterdayDateInput,
} from "@/lib/date";
import {
  type PublicBookingDraft,
  type PublicBookingSelection,
  usePublicBookingStore,
} from "@/lib/public-booking-store";
import {
  type PublicSlot,
  usePublicAvailableSlots,
} from "@/lib/public-booking-query";
import { queryKeys } from "@/lib/query-keys";
import type { Appointment } from "@/lib/types";
import { DebugOtpBox } from "@/components/ui/debug-otp-box";
import { VietnamDateInput } from "@/components/ui/vietnam-date-input";
import type { PublicHomeData } from "./public-home-types";
import { ScrollReveal } from "./scroll-reveal";

type PendingAppointment = {
  appointmentId: string;
  bookingCode: string;
  patientPhone: string;
  otpDeliveryStatus?: "PENDING" | "SENT" | "FAILED";
  debugOtp?: string;
  expiresIn: number;
  holdExpiresAt?: string | null;
};

type PublicBookingWidgetProps = {
  data: PublicHomeData;
  loading: boolean;
};

const phoneRegex = /^(0|\+84)[0-9]{9,10}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sanitizePhoneInput = (value: string) => {
  const trimmed = value.trim();
  const keepPlus = trimmed.startsWith("+") ? "+" : "";
  return `${keepPlus}${trimmed.replace(/\D/g, "")}`.slice(
    0,
    keepPlus ? 12 : 11,
  );
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value || 0);

const doctorName = (doctor: PublicHomeData["doctors"][number]) =>
  [doctor.title, doctor.user.fullName].filter(Boolean).join(" ");

const formatTime = (value: string) => value.slice(0, 5);
const toDateInputValue = (value?: string | null) =>
  value?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || "";

const buildBookingOtpMessage = (
  bookingCode: string,
  status?: PendingAppointment["otpDeliveryStatus"],
) => {
  if (status === "SENT") return `Đã gửi OTP xác nhận cho lịch ${bookingCode}.`;
  if (status === "FAILED")
    return `Chưa gửi được OTP xác nhận cho lịch ${bookingCode}. Vui lòng gửi lại OTP.`;

  return `Yêu cầu gửi OTP cho lịch ${bookingCode} đã được tiếp nhận. Vui lòng kiểm tra mã trong giây lát.`;
};

export function PublicBookingWidget({
  data,
  loading,
}: PublicBookingWidgetProps) {
  const queryClient = useQueryClient();
  const selection = usePublicBookingStore((state) => state.selection);
  const draft = usePublicBookingStore((state) => state.draft);
  const setSelectionPatch = usePublicBookingStore(
    (state) => state.setSelectionPatch,
  );
  const setDraftPatch = usePublicBookingStore((state) => state.setDraftPatch);
  const setLookupDraft = usePublicBookingStore((state) => state.setLookupDraft);
  const [slots, setSlots] = useState<PublicSlot[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<PendingAppointment | null>(null);
  const [otp, setOtp] = useState("");
  const [verifiedAppointment, setVerifiedAppointment] =
    useState<Appointment | null>(null);
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);
  const [showPhonePad, setShowPhonePad] = useState(false);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const formErrorRef = useRef<HTMLDivElement | null>(null);
  const pendingOtpRef = useRef<HTMLDivElement | null>(null);
  const verifiedBoxRef = useRef<HTMLDivElement | null>(null);
  const scrollToBox = useCallback(
    (target: { current: HTMLElement | null } | HTMLElement | null) => {
      window.setTimeout(() => {
        const element = target && "current" in target ? target.current : target;
        element?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    },
    [],
  );

  const selectedDepartment = data.departments.find(
    (item) => item.id === selection.departmentId,
  );
  const selectedDoctor = data.doctors.find(
    (item) => item.id === selection.doctorId,
  );
  const selectedPackage = data.packages.find(
    (item) => item.id === selection.packageId,
  );
  const selectedSlot = slots.find((slot) => slot.id === draft.timeSlotId);
  const filteredDoctors = selection.departmentId
    ? data.doctors.filter(
        (item) => item.department.id === selection.departmentId,
      )
    : data.doctors;
  const filteredPackages = selection.departmentId
    ? data.packages.filter(
        (item) =>
          !item.department?.id || item.department.id === selection.departmentId,
      )
    : data.packages;

  const selectedSummary = useMemo(() => {
    const amount =
      selection.serviceMode === "PACKAGE"
        ? selectedPackage?.finalPrice || 0
        : selection.serviceMode === "DOCTOR_ONLY"
          ? selectedDoctor?.consultationFee || 0
          : 0;

    return {
      departmentName: selectedDepartment?.name || "Chưa chọn chuyên khoa",
      doctorName: selectedDoctor
        ? doctorName(selectedDoctor)
        : "Chưa chọn bác sĩ",
      packageName:
        selection.serviceMode === "PACKAGE"
          ? selectedPackage?.name || "Chưa chọn gói khám"
          : selection.serviceMode === "DOCTOR_ONLY"
            ? "Khám theo bác sĩ"
            : "Chưa chọn hình thức khám",
      amount,
    };
  }, [
    selectedDepartment,
    selectedDoctor,
    selectedPackage,
    selection.serviceMode,
  ]);

  const slotsQuery = usePublicAvailableSlots({
    doctorId: selection.doctorId,
    date: draft.date,
  });
  const slotLoading =
    slotsQuery.isLoading || (slotsQuery.isFetching && !slots.length);

  useEffect(() => {
    if (!selection.doctorId || !draft.date) {
      const timeoutId = window.setTimeout(() => {
        setSlots([]);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }

    if (!slotsQuery.data) return;
    const timeoutId = window.setTimeout(() => {
      setSlots(slotsQuery.data);
      const matchedSlot = slotsQuery.data.find(
        (slot) => slot.id === draft.timeSlotId,
      );
      setDraftPatch({
        date: toDateInputValue(matchedSlot?.date) || draft.date,
        timeSlotId: slotsQuery.data.some((slot) => slot.id === draft.timeSlotId)
          ? draft.timeSlotId
          : "",
      });
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [
    draft.date,
    draft.timeSlotId,
    selection.doctorId,
    setDraftPatch,
    slotsQuery.data,
  ]);

  useEffect(() => {
    if (!slotsQuery.error) return;
    const timeoutId = window.setTimeout(() => {
      setSlots([]);
      setDraftPatch({ timeSlotId: "" });
      setError(
        slotsQuery.error instanceof Error
          ? slotsQuery.error.message
          : "Không tải được khung giờ khám",
      );
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [setDraftPatch, slotsQuery.error]);
  const updateSelection = (patch: Partial<PublicBookingSelection>) => {
    setPending(null);
    setVerifiedAppointment(null);
    setOtp("");
    setMessage("");
    setError("");
    if (patch.doctorId === "") {
      setSlots([]);
    }
    setSelectionPatch(patch);
  };

  const updateDraft = (patch: Partial<PublicBookingDraft>) => {
    setPending(null);
    setVerifiedAppointment(null);
    setOtp("");
    setMessage("");
    setError("");
    setDraftPatch(patch);
  };

  const updatePatientPhone = (value: string) => {
    updateDraft({ patientPhone: sanitizePhoneInput(value) });
  };

  const appendPhoneDigit = (digit: string) => {
    updatePatientPhone(`${draft.patientPhone}${digit}`);
  };

  const validateDraft = () => {
    if (!selection.departmentId) return "Vui lòng chọn chuyên khoa.";
    if (!selection.serviceMode)
      return "Vui lòng chọn khám theo bác sĩ hoặc một gói khám.";
    if (selection.serviceMode === "PACKAGE" && !selection.packageId)
      return "Vui lòng chọn gói khám phù hợp.";
    if (!selection.doctorId) return "Vui lòng chọn bác sĩ.";
    if (!draft.date) return "Vui lòng chọn ngày khám.";
    if (draft.date < getVietnamDateInput())
      return "Ngày khám không được nhỏ hơn ngày hiện tại.";
    if (!draft.timeSlotId) return "Vui lòng chọn khung giờ khám.";
    if (draft.patientName.trim().length < 2)
      return "Họ tên bệnh nhân tối thiểu 2 ký tự.";
    if (!phoneRegex.test(draft.patientPhone.trim()))
      return "Số điện thoại không hợp lệ.";
    if (
      draft.patientEmail.trim() &&
      !emailRegex.test(draft.patientEmail.trim())
    )
      return "Email không hợp lệ.";
    if (draft.otpChannel === "EMAIL" && !draft.patientEmail.trim())
      return "Email là bắt buộc khi xác thực OTP qua email.";
    if (draft.dateOfBirth && draft.dateOfBirth >= getVietnamDateInput())
      return "Ngày sinh phải nhỏ hơn ngày hiện tại.";
    if (draft.hasBHYT && !draft.healthInsuranceCode.trim())
      return "Vui lòng nhập mã thẻ BHYT.";

    return "";
  };

  const createAppointment = async () => {
    setError("");
    setMessage("");

    const validationError = validateDraft();
    if (validationError) {
      setError(validationError);
      scrollToBox(formErrorRef);
      return;
    }

    setSubmitting(true);

    try {
      const result = await apiRequest<PendingAppointment>("/appointments", {
        method: "POST",
        body: {
          packageId: selection.packageId || null,
          departmentId: selection.departmentId,
          doctorId: selection.doctorId,
          timeSlotId: draft.timeSlotId,
          patientName: draft.patientName.trim(),
          patientPhone: draft.patientPhone.trim(),
          patientEmail: draft.patientEmail.trim() || null,
          otpChannel: draft.otpChannel,
          reason: draft.reason.trim() || null,
          gender: draft.gender || null,
          dateOfBirth: draft.dateOfBirth || null,
          cccd: draft.cccd.trim() || null,
          address: draft.address.trim() || null,
          hasBHYT: draft.hasBHYT,
          healthInsuranceCode: draft.healthInsuranceCode.trim() || null,
          registeredHospital: draft.registeredHospital.trim() || null,
          allergies: draft.allergies.trim() || null,
          medicalHistory: draft.medicalHistory.trim() || null,
          familyHistory: draft.familyHistory.trim() || null,
        },
      });

      setLookupDraft({
        bookingCode: result.bookingCode,
        phone: result.patientPhone,
      });
      setPending(result);
      setMessage(
        buildBookingOtpMessage(result.bookingCode, result.otpDeliveryStatus),
      );
      scrollToBox(pendingOtpRef);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.publicAvailableSlots({
          doctorId: selection.doctorId,
          date: draft.date,
        }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tạo được lịch hẹn");
      scrollToBox(formErrorRef);
    } finally {
      setSubmitting(false);
    }
  };

  const verifyOtp = async () => {
    if (!pending) return;
    setError("");
    setMessage("");

    if (!/^[0-9]{6}$/.test(otp)) {
      setError("OTP phải gồm đúng 6 chữ số.");
      return;
    }

    setSubmitting(true);

    try {
      const result = await apiRequest<Appointment>(
        `/appointments/${pending.appointmentId}/verify-otp`,
        {
          method: "POST",
          body: { otp },
        },
      );

      setLookupDraft({
        bookingCode: result.bookingCode,
        phone: result.patientPhone,
      });
      setVerifiedAppointment(result);
      setPending(null);
      setMessage(
        "Xác thực OTP thành công. Lịch hẹn đang chờ bệnh viện xác nhận.",
      );
      scrollToBox(verifiedBoxRef);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.publicAvailableSlots({
          doctorId: selection.doctorId,
          date: draft.date,
        }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xác thực OTP thất bại");
      scrollToBox(pendingOtpRef);
    } finally {
      setSubmitting(false);
    }
  };

  const resendOtp = async () => {
    if (!pending) return;
    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      const result = await apiRequest<{
        expiresIn: number;
        otpDeliveryStatus?: PendingAppointment["otpDeliveryStatus"];
        debugOtp?: string;
        holdExpiresAt?: string | null;
      }>(`/appointments/${pending.appointmentId}/resend-otp`, {
        method: "POST",
      });

      setPending((current) =>
        current
          ? {
              ...current,
              expiresIn: result.expiresIn,
              otpDeliveryStatus: result.otpDeliveryStatus,
              debugOtp: result.debugOtp,
              holdExpiresAt: result.holdExpiresAt,
            }
          : current,
      );
      setMessage(
        buildBookingOtpMessage(pending.bookingCode, result.otpDeliveryStatus),
      );
      scrollToBox(pendingOtpRef);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi lại được OTP");
      scrollToBox(pendingOtpRef);
    } finally {
      setSubmitting(false);
    }
  };

  const copyBookingCode = async (bookingCode: string) => {
    try {
      await navigator.clipboard.writeText(bookingCode);
      setMessage(
        "Đã sao chép mã lịch. Vui lòng lưu lại để tra cứu hoặc xác thực sau.",
      );
    } catch {
      setMessage(
        `Mã lịch của bạn là ${bookingCode}. Vui lòng lưu lại để tra cứu hoặc xác thực sau.`,
      );
    }
  };

  return (
    <section
      id="booking"
      className="ui-container scroll-mt-24 py-12 sm:py-16"
    >
      <ScrollReveal>
        <div className="grid gap-6 rounded-xl border border-[#cfe0f3] bg-gradient-to-b from-[#f4f9ff] via-white to-white p-3 shadow-[0_18px_50px_rgba(13,79,139,0.10)] ring-1 ring-[#e7f0fb] sm:p-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-6">
          <div>
            <div className="flex items-start gap-3 rounded-lg border border-[#d8e9ff] bg-white/90 p-4 shadow-sm sm:p-5">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#e7f0fb] text-[#0d4f8b]">
                <CalendarDays className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-[#0d4f8b]">
                  Đặt lịch nhanh
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-[#172033]">
                  Chọn lịch khám và xác thực OTP
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#667892]">
                  Chọn chuyên khoa, bác sĩ và khung giờ phù hợp. Sau đó nhập
                  thông tin để bệnh viện gửi OTP giữ lịch.
                </p>
              </div>
            </div>

            <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Các bước đặt lịch">
              {["Chọn dịch vụ", "Chọn thời gian", "Nhập thông tin", "Xác thực OTP"].map(
                (label, index) => (
                  <li
                    key={label}
                    className="flex min-w-0 items-center gap-2 rounded-lg border border-[#d8e9ff] bg-white px-3 py-2.5 text-xs font-semibold text-[#42526b]"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#e7f0fb] text-[#0d4f8b]">
                      {index + 1}
                    </span>
                    <span className="truncate">{label}</span>
                  </li>
                ),
              )}
            </ol>

            <div className="mt-4 rounded-lg border border-[#d8e9ff] bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#172033]">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#e7f0fb] text-[#0d4f8b]">
                  <CalendarDays className="h-4 w-4" aria-hidden="true" />
                </span>
                Lựa chọn lịch khám
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <select
                  value={selection.departmentId}
                  onChange={(event) => {
                    updateSelection({
                      departmentId: event.target.value,
                      doctorId: "",
                      packageId: "",
                      serviceMode: "",
                    });
                    updateDraft({ timeSlotId: "" });
                  }}
                  className="ui-field px-3 py-2.5 text-sm"
                  disabled={loading}
                >
                  <option value="">Chọn chuyên khoa</option>
                  {data.departments.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Hình thức khám"
                  value={
                    !selection.serviceMode
                      ? "__UNDECIDED__"
                      : selection.serviceMode === "DOCTOR_ONLY"
                        ? ""
                        : selection.packageId
                  }
                  onChange={(event) => {
                    const packageId = event.target.value;
                    updateSelection(
                      packageId
                        ? { packageId, serviceMode: "PACKAGE" }
                        : { packageId: "", serviceMode: "DOCTOR_ONLY" },
                    );
                  }}
                  className="ui-field px-3 py-2.5 text-sm"
                  disabled={loading || !selection.departmentId}
                >
                  <option value="__UNDECIDED__" disabled>
                    Chọn hình thức khám
                  </option>
                  <option value="">Khám theo bác sĩ (không chọn gói)</option>
                  {filteredPackages.map((item) => (
                    <option key={item.id} value={item.id}>
                      Gói: {item.name}
                    </option>
                  ))}
                </select>
                <select
                  value={selection.doctorId}
                  onChange={(event) => {
                    updateSelection({ doctorId: event.target.value });
                    updateDraft({ timeSlotId: "" });
                  }}
                  className="ui-field px-3 py-2.5 text-sm"
                  disabled={loading || !selection.departmentId || !selection.serviceMode}
                >
                  <option value="">Chọn bác sĩ</option>
                  {filteredDoctors.map((item) => (
                    <option key={item.id} value={item.id}>
                      {doctorName(item)}
                    </option>
                  ))}
                </select>
              </div>

              {selection.departmentId && !selection.serviceMode ? (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-[#b8d7f4] bg-[#eef7ff] px-3 py-2.5 text-sm text-[#0d4f8b]">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <p>
                    Bạn chưa chọn gói khám. Có thể tiếp tục theo phí khám của bác sĩ
                    hoặc chọn gói để biết trước các hạng mục và chi phí.
                  </p>
                </div>
              ) : null}

              <div className="mt-4 grid gap-4 rounded-lg border border-[#e5ebf3] bg-[#f8fbff] p-3 sm:p-4 md:grid-cols-[220px_minmax(0,1fr)]">
                <label className="block">
                  <span className="text-sm font-medium text-[#334155]">
                    Ngày khám
                  </span>
                  <VietnamDateInput
                    value={draft.date}
                    min={getVietnamDateInput()}
                    onChange={(value) =>
                      updateDraft({ date: value, timeSlotId: "" })
                    }
                    ariaLabel="Ngày khám"
                    className="ui-field mt-1 w-full px-3 py-2.5 text-sm"
                  />
                  <span className="mt-1 block text-xs text-[#667892]">
                    Hiển thị theo ngày/tháng/năm, múi giờ Việt Nam
                  </span>
                </label>
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-[#334155]">
                      Khung giờ trống
                    </span>
                    {slotLoading ? (
                      <span className="inline-flex items-center gap-1 text-xs text-[#667892]">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Đang tải
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 flex min-h-11 flex-wrap gap-2">
                    {!selection.doctorId ? (
                      <span className="rounded-md border border-dashed border-[#dce3ee] px-3 py-2 text-sm text-[#667892]">
                        Chọn bác sĩ để xem slot.
                      </span>
                    ) : slotLoading ? (
                      Array.from({ length: 4 }).map((_, index) => (
                        <span
                          key={index}
                          className="skeleton-shimmer h-10 w-24 rounded-md"
                        />
                      ))
                    ) : slots.length ? (
                      slots.map((slot) => (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => updateDraft({ timeSlotId: slot.id })}
                          className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition ${
                            draft.timeSlotId === slot.id
                              ? "border-[#0d4f8b] bg-[#e7f0fb] text-[#0d4f8b] shadow-[0_8px_18px_rgba(13,79,139,0.14)] ring-2 ring-[#cfe4fa]"
                              : "border-[#cfd8e6] bg-white text-[#42526b] hover:border-[#0d4f8b] hover:bg-[#f8fbff]"
                          }`}
                        >
                          <Clock className="h-4 w-4" />
                          {formatTime(slot.startTime)} -{" "}
                          {formatTime(slot.endTime)}
                        </button>
                      ))
                    ) : (
                      <span className="rounded-md border border-dashed border-[#dce3ee] px-3 py-2 text-sm text-[#667892]">
                        {draft.date === getVietnamDateInput()
                          ? `Không còn khung giờ khả dụng hôm nay sau ${getVietnamTimeInput()}. Các slot đã qua giờ sẽ không hiển thị.`
                          : `Chưa có khung giờ trống trong ngày ${formatVietnamDate(draft.date)}.`}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-[#d8e9ff] bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#e7f0fb] text-[#0d4f8b]">
                  <UserRound className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#172033]">
                    Thông tin bắt buộc
                  </p>
                  <p className="mt-1 text-sm text-[#667892]">
                    Chỉ cần đủ thông tin liên hệ để bệnh viện gửi OTP và xác
                    nhận lịch.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-[#334155]">
                    Họ tên bệnh nhân
                  </span>
                  <input
                    value={draft.patientName}
                    onChange={(event) =>
                      updateDraft({ patientName: event.target.value })
                    }
                    className="ui-field mt-1 w-full px-3 py-2.5 text-sm"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-[#334155]">
                    Số điện thoại
                  </span>
                  <div className="relative mt-1">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667892]" />
                    <input
                      value={draft.patientPhone}
                      onChange={(event) =>
                        updatePatientPhone(event.target.value)
                      }
                      onFocus={() => setShowPhonePad(true)}
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      pattern="(0|\+84)[0-9]{9,10}"
                      placeholder="0901234567"
                      className="ui-field w-full px-3 py-2.5 pl-9 text-sm"
                      required
                    />
                  </div>
                  {showPhonePad ? (
                    <div className="mt-2 rounded-md border border-[#d8e9ff] bg-[#f8fbff] p-3 shadow-sm">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold text-[#0d4f8b]">
                          Nhập nhanh số điện thoại
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowPhonePad(false)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#667892] hover:bg-white"
                          aria-label="Đóng bàn phím số"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(
                          (digit) => (
                            <button
                              key={digit}
                              type="button"
                              onClick={() => appendPhoneDigit(digit)}
                              className="rounded-md border border-[#cfd8e6] bg-white py-2 text-sm font-semibold text-[#172033] hover:border-[#0d4f8b] hover:text-[#0d4f8b]"
                            >
                              {digit}
                            </button>
                          ),
                        )}
                        <button
                          type="button"
                          onClick={() => updatePatientPhone("+84")}
                          className="rounded-md border border-[#cfd8e6] bg-white py-2 text-sm font-semibold text-[#0d4f8b] hover:border-[#0d4f8b]"
                        >
                          +84
                        </button>
                        <button
                          type="button"
                          onClick={() => appendPhoneDigit("0")}
                          className="rounded-md border border-[#cfd8e6] bg-white py-2 text-sm font-semibold text-[#172033] hover:border-[#0d4f8b] hover:text-[#0d4f8b]"
                        >
                          0
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updatePatientPhone(draft.patientPhone.slice(0, -1))
                          }
                          className="inline-flex items-center justify-center rounded-md border border-[#cfd8e6] bg-white py-2 text-[#42526b] hover:border-[#0d4f8b] hover:text-[#0d4f8b]"
                          aria-label="Xóa một số"
                        >
                          <Delete className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-[#667892]">
                        Dùng số bắt đầu bằng 0 hoặc +84 để nhận OTP xác nhận
                        lịch hẹn.
                      </p>
                    </div>
                  ) : null}
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-[#334155]">
                    Kênh OTP
                  </span>
                  <select
                    value={draft.otpChannel}
                    onChange={(event) =>
                      updateDraft({
                        otpChannel: event.target
                          .value as PublicBookingDraft["otpChannel"],
                      })
                    }
                    className="mt-1 w-full rounded-md border border-[#cfd8e6] bg-[#fbfdff] px-3 py-2.5 text-sm outline-none transition focus:border-[#0d4f8b] focus:bg-white focus:ring-2 focus:ring-[#cfe4fa]"
                  >
                    <option value="SMS">SMS</option>
                    <option value="EMAIL">Email</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-[#334155]">
                    Email{" "}
                    {draft.otpChannel === "EMAIL"
                      ? "(bắt buộc)"
                      : "(không bắt buộc)"}
                  </span>
                  <input
                    value={draft.patientEmail}
                    onChange={(event) =>
                      updateDraft({ patientEmail: event.target.value })
                    }
                    placeholder="Nhập nếu xác thực qua email"
                    className="mt-1 w-full rounded-md border border-[#cfd8e6] bg-[#fbfdff] px-3 py-2.5 text-sm outline-none transition focus:border-[#0d4f8b] focus:bg-white focus:ring-2 focus:ring-[#cfe4fa]"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-sm font-medium text-[#334155]">
                    Lý do khám
                  </span>
                  <textarea
                    value={draft.reason}
                    onChange={(event) =>
                      updateDraft({ reason: event.target.value })
                    }
                    rows={3}
                    placeholder="Ví dụ: đau đầu, tái khám, tư vấn kết quả..."
                    className="mt-1 w-full rounded-md border border-[#cfd8e6] bg-[#fbfdff] px-3 py-2.5 text-sm outline-none transition focus:border-[#0d4f8b] focus:bg-white focus:ring-2 focus:ring-[#cfe4fa]"
                  />
                </label>
              </div>
            </div>

            <div className="mt-4 overflow-hidden rounded-md border border-[#d8e9ff] bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setShowAdditionalInfo((current) => !current)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <span>
                  <span className="block text-sm font-semibold text-[#172033]">
                    Thông tin bổ sung
                  </span>
                  <span className="mt-1 block text-sm text-[#667892]">
                    Ngày sinh, BHYT và tiền sử bệnh. Có thể nhập để hồ sơ khám
                    đầy đủ hơn.
                  </span>
                </span>
                <span className="shrink-0 rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-semibold text-[#42526b]">
                  {showAdditionalInfo ? "Ẩn bớt" : "Nhập thêm"}
                </span>
              </button>

              {showAdditionalInfo ? (
                <div className="grid gap-3 border-t border-[#e5ebf3] p-4 md:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-medium text-[#334155]">
                      Giới tính
                    </span>
                    <select
                      value={draft.gender}
                      onChange={(event) =>
                        updateDraft({
                          gender: event.target
                            .value as PublicBookingDraft["gender"],
                        })
                      }
                      className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2.5 text-sm outline-none focus:border-[#0d4f8b]"
                    >
                      <option value="">Chưa chọn</option>
                      <option value="MALE">Nam</option>
                      <option value="FEMALE">Nữ</option>
                      <option value="OTHER">Khác</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-[#334155]">
                      Ngày sinh
                    </span>
                    <VietnamDateInput
                      max={getVietnamYesterdayDateInput()}
                      value={draft.dateOfBirth}
                      onChange={(value) => updateDraft({ dateOfBirth: value })}
                      ariaLabel="Ngày sinh"
                      className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2.5 text-sm outline-none focus:border-[#0d4f8b]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-[#334155]">
                      CCCD
                    </span>
                    <input
                      value={draft.cccd}
                      onChange={(event) =>
                        updateDraft({ cccd: event.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2.5 text-sm outline-none focus:border-[#0d4f8b]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-[#334155]">
                      Địa chỉ
                    </span>
                    <input
                      value={draft.address}
                      onChange={(event) =>
                        updateDraft({ address: event.target.value })
                      }
                      className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2.5 text-sm outline-none focus:border-[#0d4f8b]"
                    />
                  </label>
                  <label className="flex items-center gap-2 rounded-md border border-[#dce3ee] px-3 py-2 text-sm text-[#42526b]">
                    <input
                      type="checkbox"
                      checked={draft.hasBHYT}
                      onChange={(event) =>
                        updateDraft({ hasBHYT: event.target.checked })
                      }
                    />
                    Có bảo hiểm y tế
                  </label>
                  {draft.hasBHYT ? (
                    <>
                      <input
                        value={draft.healthInsuranceCode}
                        onChange={(event) =>
                          updateDraft({
                            healthInsuranceCode: event.target.value,
                          })
                        }
                        placeholder="Mã thẻ BHYT"
                        className="rounded-md border border-[#cfd8e6] px-3 py-2.5 text-sm outline-none focus:border-[#0d4f8b]"
                      />
                      <input
                        value={draft.registeredHospital}
                        onChange={(event) =>
                          updateDraft({
                            registeredHospital: event.target.value,
                          })
                        }
                        placeholder="Nơi đăng ký khám chữa bệnh ban đầu"
                        className="rounded-md border border-[#cfd8e6] px-3 py-2.5 text-sm outline-none focus:border-[#0d4f8b] md:col-span-2"
                      />
                    </>
                  ) : null}
                  <label className="block md:col-span-2">
                    <span className="text-sm font-medium text-[#334155]">
                      Dị ứng
                    </span>
                    <textarea
                      value={draft.allergies}
                      onChange={(event) =>
                        updateDraft({ allergies: event.target.value })
                      }
                      rows={2}
                      placeholder="Thuốc, thức ăn hoặc tác nhân từng gây dị ứng"
                      className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2.5 text-sm outline-none focus:border-[#0d4f8b]"
                    />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="text-sm font-medium text-[#334155]">
                      Tiền sử bệnh
                    </span>
                    <textarea
                      value={draft.medicalHistory}
                      onChange={(event) =>
                        updateDraft({ medicalHistory: event.target.value })
                      }
                      rows={2}
                      placeholder="Bệnh nền, phẫu thuật, thuốc đang dùng..."
                      className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2.5 text-sm outline-none focus:border-[#0d4f8b]"
                    />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="text-sm font-medium text-[#334155]">
                      Tiền sử gia đình
                    </span>
                    <textarea
                      value={draft.familyHistory}
                      onChange={(event) =>
                        updateDraft({ familyHistory: event.target.value })
                      }
                      rows={2}
                      placeholder="Các bệnh di truyền hoặc bệnh thường gặp trong gia đình"
                      className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2.5 text-sm outline-none focus:border-[#0d4f8b]"
                    />
                  </label>
                </div>
              ) : null}
            </div>

            {error ? (
              <div
                ref={formErrorRef}
                className="mt-5 scroll-mt-24 flex items-start gap-2 rounded-md border border-[#f2b8b5] bg-[#fff3f2] px-4 py-3 text-sm font-medium text-[#b3261e] shadow-sm"
              >
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => void createAppointment()}
                disabled={submitting || loading}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-[#0d4f8b] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_26px_rgba(13,79,139,0.22)] transition hover:-translate-y-0.5 hover:bg-[#083d6d] disabled:translate-y-0 disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Tạo lịch và gửi OTP
              </button>
              <span className="text-sm text-[#667892]">
                Sau khi xác thực OTP, lịch sẽ chuyển sang trạng thái chờ xác
                nhận.{" "}
                <Link
                  href="/guide/booking"
                  className="font-semibold text-[#0d4f8b]"
                >
                  Cần hướng dẫn?
                </Link>
              </span>
            </div>
          </div>

          <aside
            ref={resultRef}
            className="scroll-mt-24 rounded-lg border border-[#d8e9ff] bg-white p-4 shadow-sm lg:sticky lg:top-24 lg:self-start"
          >
            <div className="rounded-md border border-[#e5ebf3] bg-[#f8fbff] p-4">
              <p className="text-sm font-semibold text-[#172033]">
                Tóm tắt lịch hẹn
              </p>
              <div className="mt-3 space-y-2 text-sm">
                <SummaryLink
                  label="Chuyên khoa"
                  value={selectedSummary.departmentName}
                  hint={
                    selectedDepartment
                      ? "Bấm để xem nhanh thông tin khoa"
                      : "Chọn khoa để hệ thống lọc bác sĩ và gói khám"
                  }
                  href={
                    selectedDepartment
                      ? selectedDepartment.slug
                        ? `/departments/${selectedDepartment.slug}`
                        : `/departments`
                      : undefined
                  }
                />
                <SummaryLink
                  label="Bác sĩ"
                  value={selectedSummary.doctorName}
                  hint={
                    selectedDoctor
                      ? "Bấm để xem nhanh hồ sơ bác sĩ"
                      : "Chọn bác sĩ để xem lịch trống"
                  }
                  href={
                    selectedDoctor ? `/doctors/${selectedDoctor.id}` : undefined
                  }
                />
                <SummaryLink
                  label="Gói khám"
                  value={selectedSummary.packageName}
                  hint={
                    selectedPackage
                      ? "Bấm để xem nhanh hạng mục và giá gói"
                      : selection.serviceMode === "DOCTOR_ONLY"
                        ? "Giá tạm tính theo phí khám của bác sĩ"
                        : "Chọn khám theo bác sĩ hoặc một gói khám"
                  }
                  href={
                    selectedPackage
                      ? `/packages/${selectedPackage.slug || selectedPackage.id}`
                      : undefined
                  }
                />
                <div className="rounded-md border border-[#e5ebf3] bg-white px-3 py-2">
                  <span className="text-xs font-medium text-[#667892]">
                    Ngày khám
                  </span>
                  <p className="mt-1 flex items-center gap-2 font-semibold text-[#172033]">
                    <CalendarDays className="h-4 w-4 text-[#0d4f8b]" />
                    {draft.date
                      ? formatVietnamDate(draft.date)
                      : "Chưa chọn ngày"}
                  </p>
                </div>
                <div className="rounded-md border border-[#e5ebf3] bg-white px-3 py-2">
                  <span className="text-xs font-medium text-[#667892]">
                    Giờ khám
                  </span>
                  <p className="mt-1 flex items-center gap-2 font-semibold text-[#172033]">
                    <Clock className="h-4 w-4 text-[#0d4f8b]" />
                    {selectedSlot
                      ? `${formatTime(selectedSlot.startTime)} - ${formatTime(selectedSlot.endTime)}`
                      : "Chưa chọn khung giờ"}
                  </p>
                </div>
              </div>
              <div className="mt-4 rounded-md border border-[#cfe4fa] bg-white px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#667892]">
                  Tạm tính
                </p>
                <p className="mt-1 text-lg font-semibold text-[#0d4f8b]">
                  {selectedSummary.amount
                    ? formatCurrency(selectedSummary.amount)
                    : "Sẽ tính theo lựa chọn"}
                </p>
                <p className="mt-2 text-xs leading-5 text-[#667892]">
                  {selection.serviceMode === "PACKAGE" && selectedPackage
                    ? "Giá tạm tính dựa trên gói khám đã chọn, bao gồm các hạng mục đang được cấu hình trong gói."
                    : selection.serviceMode === "DOCTOR_ONLY" && selectedDoctor
                      ? "Giá tạm tính dựa trên phí khám của bác sĩ đã chọn. Chi phí cuối cùng có thể thay đổi sau khi bệnh viện xác nhận."
                      : "Giá sẽ hiển thị sau khi bạn chọn hình thức khám và bác sĩ."}
                </p>
              </div>
            </div>

            {message ? (
              <div className="mt-4 flex items-start gap-2 rounded-md border border-[#bde5c8] bg-[#f0fff4] px-3 py-2 text-sm text-[#1f7a3a] shadow-sm">
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span>{message}</span>
              </div>
            ) : null}

            {pending ? (
              <div
                ref={pendingOtpRef}
                className="mt-5 scroll-mt-24 rounded-md border border-[#cfe4fa] bg-[#fbfdff] p-4 shadow-sm"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-[#0d4f8b]">
                  <ShieldCheck className="h-4 w-4" />
                  Xác thực OTP
                </div>
                <div className="mt-3 rounded-md border border-[#cfe4fa] bg-[#f3f8ff] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#667892]">
                    Mã đặt lịch cần lưu
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="break-all text-lg font-semibold text-[#172033]">
                      {pending.bookingCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => void copyBookingCode(pending.bookingCode)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#cfd8e6] bg-white px-2 py-1.5 text-xs font-semibold text-[#42526b] hover:bg-[#f8fafc]"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex items-start gap-2 rounded-md border border-[#b8d7f4] bg-[#eef7ff] px-3 py-2.5 text-[#0d4f8b]">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white text-[#0d4f8b] shadow-sm">
                    <Info className="h-4 w-4" />
                  </span>
                  <p className="text-xs font-medium leading-5">
                    Nếu lỡ thoát màn hình này, hãy vào{" "}
                    <Link
                      href={`/appointments/lookup?bookingCode=${pending.bookingCode}&phone=${pending.patientPhone}`}
                      className="font-semibold underline underline-offset-2"
                    >
                      Tra cứu lịch hẹn
                    </Link>
                    , nhập mã lịch và số điện thoại để xác thực OTP lại.
                  </p>
                </div>
                <DebugOtpBox
                  otp={pending.debugOtp}
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
                  className="mt-3 w-full rounded-md border border-[#cfd8e6] px-3 py-2.5 text-center text-xl font-semibold tracking-[0.25em] outline-none focus:border-[#0d4f8b]"
                />
                <button
                  type="button"
                  onClick={() => void verifyOtp()}
                  disabled={submitting || otp.length !== 6}
                  className="mt-3 w-full rounded-md bg-[#0d4f8b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#083d6d] disabled:opacity-60"
                >
                  Xác nhận OTP
                </button>
                <button
                  type="button"
                  onClick={() => void resendOtp()}
                  disabled={submitting}
                  className="mt-2 w-full rounded-md border border-[#cfd8e6] px-4 py-2.5 text-sm font-medium text-[#42526b] hover:bg-[#f6f8fb] disabled:opacity-60"
                >
                  Gửi lại OTP
                </button>
                <Link
                  href={`/appointments/lookup?bookingCode=${pending.bookingCode}&phone=${pending.patientPhone}`}
                  className="mt-2 inline-flex w-full items-center justify-center rounded-md border border-[#cfd8e6] px-4 py-2.5 text-sm font-semibold text-[#42526b] hover:bg-[#f8fafc]"
                >
                  Xác thực lại qua tra cứu
                </Link>
              </div>
            ) : null}

            {verifiedAppointment ? (
              <div
                ref={verifiedBoxRef}
                className="mt-5 scroll-mt-24 rounded-md border border-[#bde5c8] bg-[#fbfffc] p-4 shadow-sm"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-[#1f7a3a]">
                  <CheckCircle2 className="h-4 w-4" />
                  Đặt lịch thành công
                </div>
                <div className="mt-3 space-y-2 text-sm text-[#667892]">
                  <div className="rounded-md border border-[#bde5c8] bg-[#f0fff4] p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#1f7a3a]">
                      Mã lịch cần lưu
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="break-all text-lg font-semibold text-[#172033]">
                        {verifiedAppointment.bookingCode}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          void copyBookingCode(verifiedAppointment.bookingCode)
                        }
                        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#bde5c8] bg-white px-2 py-1.5 text-xs font-semibold text-[#1f7a3a] hover:bg-[#f8fafc]"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </button>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-[#667892]">
                      Hãy lưu mã này để tra cứu lịch, thanh toán, hủy lịch hoặc
                      xem kết quả khám sau này.
                    </p>
                  </div>
                  <p>
                    Trạng thái:{" "}
                    <span className="font-semibold text-[#172033]">
                      {verifiedAppointment.status}
                    </span>
                  </p>
                  <p>
                    Giờ khám: {formatTime(verifiedAppointment.startTime)} -{" "}
                    {formatTime(verifiedAppointment.endTime)}
                  </p>
                  <p>
                    Phí dự kiến:{" "}
                    {formatCurrency(verifiedAppointment.finalAmount)}
                  </p>
                </div>
                <div className="mt-4 rounded-md border border-[#e5ebf3] bg-[#f8fafc] p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#172033]">
                    <CreditCard className="h-4 w-4 text-[#0d4f8b]" />
                    Hóa đơn sau khi khám
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#667892]">
                    Hóa đơn và thanh toán online sẽ hiển thị trong trang tra cứu
                    sau khi bệnh viện hoàn tất khám và phát hành hóa đơn.
                  </p>
                </div>
                <Link
                  href={`/appointments/lookup?bookingCode=${verifiedAppointment.bookingCode}&phone=${verifiedAppointment.patientPhone}`}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-md border border-[#cfd8e6] px-4 py-2.5 text-sm font-semibold text-[#42526b] hover:bg-[#f8fafc]"
                >
                  Tra cứu lịch hẹn
                </Link>
              </div>
            ) : null}
          </aside>
        </div>
      </ScrollReveal>
    </section>
  );
}

function SummaryLink({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint: string;
  href?: string;
}) {
  const content = (
    <>
      <span className="text-xs font-medium text-[#667892]">{label}</span>
      <span className="mt-1 block font-semibold text-[#172033]">{value}</span>
      <span className="mt-1 block text-xs leading-5 text-[#667892]">
        {hint}
      </span>
    </>
  );

  if (!href) {
    return (
      <div className="rounded-md border border-[#e5ebf3] bg-white px-3 py-2">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className="block rounded-md border border-[#e5ebf3] bg-white px-3 py-2 transition hover:border-[#0d4f8b] hover:bg-[#f8fbff]"
    >
      {content}
    </Link>
  );
}
