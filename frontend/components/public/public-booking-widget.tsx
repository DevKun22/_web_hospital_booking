"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Copy,
  CreditCard,
  Info,
  Loader2,
  PackageCheck,
  Phone,
  Send,
  ShieldCheck,
  Stethoscope,
  TimerReset,
} from "lucide-react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  initialBookingDraft,
  usePublicBookingStore,
} from "@/lib/public-booking-store";
import {
  type PublicSlot,
  usePublicAvailableSlots,
} from "@/lib/public-booking-query";
import { queryKeys } from "@/lib/query-keys";
import { usePublicCapabilities } from "@/lib/public-capabilities-query";
import {
  clearPublicPendingAppointment,
  readPublicPendingAppointment,
  type PublicPendingAppointment,
  writePublicPendingAppointment,
} from "@/lib/public-pending-booking";
import type { Appointment } from "@/lib/types";
import {
  buildPatientBookingPrefill,
} from "@/lib/public-booking-profile";
import {
  loadOptionalPatientSession,
  patientSessionQueryKey,
} from "@/lib/patient-session-client";
import { DebugOtpBox } from "@/components/ui/debug-otp-box";
import { VietnamDateInput } from "@/components/ui/vietnam-date-input";
import type { PublicHomeData } from "./public-home-types";
import { ScrollReveal } from "./scroll-reveal";

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
  status?: PublicPendingAppointment["otpDeliveryStatus"],
) => {
  if (status === "SENT") return `Đã gửi OTP xác nhận cho lịch ${bookingCode}.`;
  if (status === "FAILED")
    return `Chưa gửi được OTP xác nhận cho lịch ${bookingCode}. Vui lòng gửi lại OTP.`;

  return `Yêu cầu gửi OTP cho lịch ${bookingCode} đã được tiếp nhận. Vui lòng kiểm tra mã trong giây lát.`;
};

const formatCountdown = (seconds: number) => {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
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
  const profileOwnerId = usePublicBookingStore((state) => state.profileOwnerId);
  const applyPatientProfile = usePublicBookingStore(
    (state) => state.applyPatientProfile,
  );
  const clearPatientProfile = usePublicBookingStore(
    (state) => state.clearPatientProfile,
  );
  const setLookupDraft = usePublicBookingStore((state) => state.setLookupDraft);
  const [slots, setSlots] = useState<PublicSlot[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<PublicPendingAppointment | null>(null);
  const [pendingHydrated, setPendingHydrated] = useState(false);
  const [holdSeconds, setHoldSeconds] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otp, setOtp] = useState("");
  const [verifiedAppointment, setVerifiedAppointment] =
    useState<Appointment | null>(null);
  const [showAdditionalInfo, setShowAdditionalInfo] = useState(false);
  const [flowStep, setFlowStep] = useState(0);
  const profilePrefillAppliedRef = useRef<string | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);
  const formErrorRef = useRef<HTMLDivElement | null>(null);
  const pendingOtpRef = useRef<HTMLDivElement | null>(null);
  const verifiedBoxRef = useRef<HTMLDivElement | null>(null);
  const scrollToBox = useCallback(
    (target: { current: HTMLElement | null } | HTMLElement | null) => {
      window.setTimeout(() => {
        const element = target && "current" in target ? target.current : target;
        element?.scrollIntoView({ behavior: "smooth", block: "center" });
        element?.focus({ preventScroll: true });
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
  const activeBookingStep = pending || verifiedAppointment ? 3 : flowStep;
  const supportHotline =
    data.settings?.hotline?.trim() ||
    data.settings?.emergencyHotline?.trim() ||
    "";

  const slotsQuery = usePublicAvailableSlots({
    doctorId: selection.doctorId,
    date: draft.date,
  });
  const slotLoading =
    slotsQuery.isLoading || (slotsQuery.isFetching && !slots.length);
  const otpChannels = usePublicCapabilities().data?.otp.channels ?? ["EMAIL"];
  const patientProfileQuery = useQuery({
    queryKey: patientSessionQueryKey,
    queryFn: loadOptionalPatientSession,
    retry: false,
    staleTime: 0,
  });

  useEffect(() => {
    const profile = patientProfileQuery.data;
    if (!profile) {
      if (patientProfileQuery.isSuccess && profileOwnerId) {
        profilePrefillAppliedRef.current = null;
        clearPatientProfile();
      }
      return;
    }
    if (profilePrefillAppliedRef.current === profile.id) return;

    profilePrefillAppliedRef.current = profile.id;
    const sourceDraft =
      profileOwnerId && profileOwnerId !== profile.id
        ? {
            ...initialBookingDraft,
            date: draft.date,
            timeSlotId: draft.timeSlotId,
          }
        : draft;
    const patch = buildPatientBookingPrefill(sourceDraft, profile);

    applyPatientProfile(profile.id, patch);
  }, [
    applyPatientProfile,
    clearPatientProfile,
    draft,
    patientProfileQuery.data,
    patientProfileQuery.isSuccess,
    profileOwnerId,
  ]);
  const profilePrefilled = Boolean(
    patientProfileQuery.data &&
      ((patientProfileQuery.data.fullName &&
        draft.patientName === patientProfileQuery.data.fullName) ||
        (patientProfileQuery.data.phone &&
          draft.patientPhone === patientProfileQuery.data.phone)),
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const restored = readPublicPendingAppointment();
      if (!restored) {
        setPendingHydrated(true);
        return;
      }

      const holdExpiresAt = restored.holdExpiresAt
        ? new Date(restored.holdExpiresAt).getTime()
        : 0;
      if (holdExpiresAt && holdExpiresAt <= Date.now()) {
        clearPublicPendingAppointment();
        setError(
          "Phiên giữ khung giờ trước đó đã hết hạn. Vui lòng chọn lại khung giờ.",
        );
        setFlowStep(1);
        setPendingHydrated(true);
        return;
      }

      setPending(restored);
      setLookupDraft({
        bookingCode: restored.bookingCode,
        phone: restored.patientPhone,
      });
      setFlowStep(3);
      setResendCooldown(30);
      setMessage(
        `Đã khôi phục phiên xác thực cho lịch ${restored.bookingCode}.`,
      );
      setPendingHydrated(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [setLookupDraft]);

  useEffect(() => {
    if (!pendingHydrated) return;
    if (pending) writePublicPendingAppointment(pending);
    else clearPublicPendingAppointment();
  }, [pending, pendingHydrated]);

  useEffect(() => {
    if (!pending?.holdExpiresAt) {
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(
        0,
        Math.ceil(
          (new Date(pending.holdExpiresAt || "").getTime() - Date.now()) /
            1000,
        ),
      );
      setHoldSeconds(remaining);

      if (remaining === 0) {
        clearPublicPendingAppointment();
        setPending(null);
        setOtp("");
        setFlowStep(1);
        setMessage("");
        setError(
          "Thời gian giữ khung giờ đã hết. Vui lòng chọn lại khung giờ để tiếp tục.",
        );
        void queryClient.invalidateQueries({
          queryKey: queryKeys.publicAvailableSlots({
            doctorId: selection.doctorId,
            date: draft.date,
          }),
        });
      }
    };

    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(intervalId);
  }, [
    draft.date,
    pending?.holdExpiresAt,
    queryClient,
    selection.doctorId,
  ]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timeoutId = window.setTimeout(
      () => setResendCooldown((current) => Math.max(0, current - 1)),
      1000,
    );
    return () => window.clearTimeout(timeoutId);
  }, [resendCooldown]);

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

  // Nếu kênh đang chọn không còn được backend hỗ trợ (vd. SMS chưa cấu hình),
  // chuyển sang kênh khả dụng đầu tiên.
  const otpChannelUnavailable = !otpChannels.includes(draft.otpChannel);
  const firstOtpChannel = otpChannels[0];
  useEffect(() => {
    if (!otpChannelUnavailable || !firstOtpChannel) return;
    const timeoutId = window.setTimeout(() => setDraftPatch({ otpChannel: firstOtpChannel }), 0);
    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpChannelUnavailable, firstOtpChannel]);

  const updatePatientPhone = (value: string) => {
    updateDraft({ patientPhone: sanitizePhoneInput(value) });
  };

  const showStepError = (message: string) => {
    setError(message);
    scrollToBox(formErrorRef);
  };

  const continueFromService = () => {
    if (!selection.departmentId) return showStepError("Vui lòng chọn chuyên khoa.");
    if (!selection.serviceMode)
      return showStepError("Vui lòng chọn khám theo bác sĩ hoặc một gói khám.");
    if (selection.serviceMode === "PACKAGE" && !selection.packageId)
      return showStepError("Vui lòng chọn gói khám phù hợp.");
    if (!selection.doctorId) return showStepError("Vui lòng chọn bác sĩ.");
    setError("");
    setFlowStep(1);
  };

  const continueFromSchedule = () => {
    if (!draft.date) return showStepError("Vui lòng chọn ngày khám.");
    if (draft.date < getVietnamDateInput())
      return showStepError("Ngày khám không được nhỏ hơn ngày hiện tại.");
    if (!draft.timeSlotId) return showStepError("Vui lòng chọn khung giờ khám.");
    setError("");
    setFlowStep(2);
  };

  const hasHealthDeclaration = Boolean(
    draft.allergies.trim() || draft.medicalHistory.trim() || draft.familyHistory.trim(),
  );

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
      return "Họ tên người khám tối thiểu 2 ký tự.";
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
    if (hasHealthDeclaration && !draft.healthConsent)
      return "Vui lòng đồng ý cho bệnh viện lưu thông tin sức khỏe bạn đã khai báo, hoặc xóa phần dị ứng và tiền sử.";

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
      const result = await apiRequest<PublicPendingAppointment>("/appointments", {
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
          healthConsent: hasHealthDeclaration ? draft.healthConsent : undefined,
        },
      });

      setLookupDraft({
        bookingCode: result.bookingCode,
        phone: result.patientPhone,
      });
      setPending(result);
      setResendCooldown(30);
      setFlowStep(3);
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
      clearPublicPendingAppointment();
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
        otpDeliveryStatus?: PublicPendingAppointment["otpDeliveryStatus"];
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
      setResendCooldown(30);
      scrollToBox(pendingOtpRef);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi lại được OTP");
      scrollToBox(pendingOtpRef);
    } finally {
      setSubmitting(false);
    }
  };

  const abandonPendingAppointment = async () => {
    if (!pending || submitting) return;

    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      if (pending.holdReleaseToken) {
        await apiRequest(`/appointments/${pending.appointmentId}/pending`, {
          method: "DELETE",
          body: { holdReleaseToken: pending.holdReleaseToken },
        });
      }

      clearPublicPendingAppointment();
      setPending(null);
      setOtp("");
      setHoldSeconds(0);
      setResendCooldown(0);
      setFlowStep(1);
      setDraftPatch({ timeSlotId: "" });
      setMessage(
        pending.holdReleaseToken
          ? "Đã trả khung giờ. Vui lòng chọn thời gian khác để tiếp tục."
          : "Đã đóng phiên xác thực cũ. Vui lòng chọn lại khung giờ.",
      );
      void queryClient.invalidateQueries({
        queryKey: queryKeys.publicAvailableSlots({
          doctorId: selection.doctorId,
          date: draft.date,
        }),
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể trả khung giờ lúc này. Vui lòng thử lại.",
      );
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
      className="ui-container scroll-mt-24 py-8 sm:py-10"
    >
      <ScrollReveal>
        <div className="grid items-start gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-8">
            <div className="flex items-start gap-3 rounded-2xl border border-[var(--public-border)] bg-white p-4 shadow-sm sm:p-5">
              <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--public-primary-soft)] text-[var(--public-primary)]">
                <CalendarDays className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--public-primary)]">
                  Phiếu đặt lịch trực tuyến
                </p>
                <h2 className="mt-1 text-xl font-bold text-[var(--public-ink)] sm:text-2xl">
                  Hoàn tất từng bước để xác nhận lịch
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--public-muted)]">
                  Hệ thống chỉ hiển thị chuyên khoa, bác sĩ, gói khám và khung giờ đang có trong dữ liệu hiện tại.
                </p>
              </div>
            </div>

            <div className="relative mt-4 rounded-2xl border border-[var(--public-border)] bg-white px-2 py-4 shadow-sm sm:px-4">
              <span className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-[2.05rem] h-0.5 bg-[var(--public-border)]" aria-hidden="true">
                <span className="block h-full bg-[var(--public-primary)] transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${Math.min(activeBookingStep, 3) / 3 * 100}%` }} />
              </span>
              <ol className="relative grid grid-cols-4" aria-label="Các bước đặt lịch">
                {[
                  ["Dịch vụ", "Chuyên khoa & bác sĩ"],
                  ["Thời gian", "Ngày & khung giờ"],
                  ["Thông tin", "Người khám & BHYT"],
                  ["Xác thực", "Mã OTP 6 số"],
                ].map(([label, description], index) => (
                  <li key={label} aria-current={activeBookingStep === index ? "step" : undefined} className="relative z-10 flex min-w-0 flex-col items-center px-1 text-center">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold shadow-sm ${index < activeBookingStep ? "border-[var(--public-primary)] bg-[var(--public-primary)] text-white" : activeBookingStep === index ? "border-[var(--public-primary)] bg-white text-[var(--public-primary)] ring-4 ring-[var(--public-primary-soft)]" : "border-[var(--public-border)] bg-[var(--public-surface-muted)] text-[var(--public-muted)]"}`}>
                      {index < activeBookingStep ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : index + 1}
                    </span>
                    <span className={`mt-2 text-[11px] font-bold sm:text-xs ${index <= activeBookingStep ? "text-[var(--public-primary-dark)]" : "text-[var(--public-muted)]"}`}>{label}</span>
                    <span className="mt-0.5 hidden text-[10px] leading-4 text-[var(--public-muted)] sm:block">{description}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className={`${flowStep <= 1 ? "mt-4" : "hidden"} rounded-2xl border border-[var(--public-border)] bg-white p-4 shadow-sm sm:p-6`}>
              <div className="mb-5 flex items-center gap-3 border-b border-[var(--public-divider)] pb-4 text-sm font-semibold text-[var(--public-ink)]">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--public-primary-soft)] text-[var(--public-primary)]">
                  <span className="text-xs font-bold tabular-nums">0{flowStep + 1}</span>
                </span>
                {flowStep === 0 ? "Chọn chuyên khoa và dịch vụ" : "Chọn ngày và khung giờ khám"}
              </div>
              <div className={`${flowStep === 0 ? "block" : "hidden"}`}>
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--public-ink)]">Chuyên khoa tiếp nhận <span className="text-[var(--public-danger)]">*</span></span>
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
                    className="ui-field mt-2 w-full px-3 py-3 text-base sm:text-sm"
                    disabled={loading}
                  >
                    <option value="">Chọn chuyên khoa phù hợp</option>
                    {data.departments.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </label>

                <fieldset className="mt-5" disabled={loading || !selection.departmentId}>
                  <legend className="text-sm font-semibold text-[var(--public-ink)]">Phương thức chọn khám <span className="text-[var(--public-danger)]">*</span></legend>
                  <div className="mt-2 grid gap-2 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface-muted)] p-1.5 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => updateSelection({ serviceMode: "DOCTOR_ONLY", packageId: "" })}
                      aria-pressed={selection.serviceMode === "DOCTOR_ONLY"}
                      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition ${selection.serviceMode === "DOCTOR_ONLY" ? "border border-[var(--public-border)] bg-white text-[var(--public-primary-dark)] shadow-sm" : "text-[var(--public-text-soft)] hover:bg-white/70 hover:text-[var(--public-primary)]"}`}
                    >
                      <Stethoscope className="h-4 w-4" aria-hidden="true" />
                      Khám theo bác sĩ
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSelection({ serviceMode: "PACKAGE", packageId: "" })}
                      aria-pressed={selection.serviceMode === "PACKAGE"}
                      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold transition ${selection.serviceMode === "PACKAGE" ? "border border-[var(--public-border)] bg-white text-[var(--public-primary-dark)] shadow-sm" : "text-[var(--public-text-soft)] hover:bg-white/70 hover:text-[var(--public-primary)]"}`}
                    >
                      <PackageCheck className="h-4 w-4" aria-hidden="true" />
                      Chọn gói khám
                    </button>
                  </div>
                </fieldset>

                {selection.serviceMode ? (
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {selection.serviceMode === "PACKAGE" ? (
                      <label className="block">
                        <span className="text-sm font-semibold text-[var(--public-ink)]">Gói khám <span className="text-[var(--public-danger)]">*</span></span>
                        <select
                          value={selection.packageId}
                          onChange={(event) => updateSelection({ packageId: event.target.value })}
                          className="ui-field mt-2 w-full px-3 py-3 text-base sm:text-sm"
                        >
                          <option value="">Chọn gói khám</option>
                          {filteredPackages.map((item) => (
                            <option key={item.id} value={item.id}>{item.name} · {formatCurrency(item.finalPrice)}</option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <div className="rounded-xl border border-[var(--public-border)] bg-[var(--public-primary-soft)] px-4 py-3 text-sm leading-6 text-[var(--public-primary-dark)]">
                        Phí dự kiến sẽ được tính theo bác sĩ bạn chọn.
                      </div>
                    )}
                    <label className="block">
                      <span className="text-sm font-semibold text-[var(--public-ink)]">
                        Bác sĩ tiếp nhận <span className="text-[var(--public-danger)]">*</span>
                        {selection.serviceMode === "PACKAGE" ? (
                          <span className="ml-1 font-normal text-[var(--public-muted)]">(không tính phí khám riêng)</span>
                        ) : null}
                      </span>
                      <select
                        value={selection.doctorId}
                        onChange={(event) => {
                          updateSelection({ doctorId: event.target.value });
                          updateDraft({ timeSlotId: "" });
                        }}
                        className="ui-field mt-2 w-full px-3 py-3 text-base sm:text-sm"
                        disabled={selection.serviceMode === "PACKAGE" && !selection.packageId}
                      >
                        <option value="">Chọn bác sĩ</option>
                        {filteredDoctors.map((item) => (
                          <option key={item.id} value={item.id}>
                            {doctorName(item)}
                            {selection.serviceMode === "DOCTOR_ONLY"
                              ? ` · ${formatCurrency(item.consultationFee)}`
                              : ""}
                          </option>
                        ))}
                      </select>
                      {selection.serviceMode === "PACKAGE" ? (
                        <span className="mt-1.5 block text-xs leading-5 text-[var(--public-muted)]">
                          Bác sĩ được chọn để tiếp nhận gói; tạm tính chỉ theo giá gói đang hiển thị.
                        </span>
                      ) : null}
                    </label>
                  </div>
                ) : null}
              </div>

              {flowStep === 0 && selection.departmentId && !selection.serviceMode ? (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--public-border)] bg-[var(--public-primary-soft)] px-3 py-2.5 text-sm text-[var(--public-primary-dark)]">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <p>
                    Chọn khám theo bác sĩ hoặc chọn một gói khám đang có trong hệ thống để tiếp tục.
                  </p>
                </div>
              ) : null}

              <div className={`${flowStep === 1 ? "grid" : "hidden"} gap-5 md:grid-cols-[220px_minmax(0,1fr)]`}>
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
                        Chọn bác sĩ để xem khung giờ.
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
                              ? "border-[var(--public-primary)] bg-[var(--public-primary-soft)] text-[var(--public-primary-dark)] shadow-sm ring-2 ring-[var(--public-border)]"
                              : "border-[var(--public-border)] bg-white text-[var(--public-text-soft)] hover:border-[var(--public-primary)] hover:bg-[var(--public-primary-soft)]"
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
                          ? `Không còn khung giờ khả dụng hôm nay sau ${getVietnamTimeInput()}. Các giờ đã qua sẽ không hiển thị.`
                          : `Chưa có khung giờ trống trong ngày ${formatVietnamDate(draft.date)}.`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--public-divider)] pt-4">
                {flowStep === 1 ? (
                  <button type="button" onClick={() => { setError(""); setFlowStep(0); }} className="public-button-secondary inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold">
                    Quay lại
                  </button>
                ) : <span />}
                <button type="button" onClick={flowStep === 0 ? continueFromService : continueFromSchedule} className="public-button-primary ml-auto inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-2.5 text-sm font-bold">
                  Tiếp tục
                  <ChevronRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className={`${flowStep === 2 ? "mt-4" : "hidden"} rounded-2xl border border-[var(--public-border)] bg-white p-4 shadow-sm sm:p-6`}>
              <div className="flex items-start gap-3 border-b border-[var(--public-divider)] pb-4">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--public-primary-soft)] text-[var(--public-primary)]">
                  <span className="text-xs font-bold tabular-nums">03</span>
                </span>
                <div>
                  <p className="text-sm font-bold text-[var(--public-ink)]">
                    Thông tin người khám
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[var(--public-muted)]">
                    Họ tên và số điện thoại là thông tin bắt buộc để tạo lịch và gửi OTP.
                  </p>
                </div>
              </div>

              {profilePrefilled ? (
                <div
                  className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                  role="status"
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <CheckCircle2
                      className="h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    Đã tự điền thông tin từ hồ sơ tài khoản.
                  </span>
                  <Link
                    href="/tai-khoan/ho-so"
                    className="inline-flex min-h-8 items-center font-bold underline decoration-emerald-300 underline-offset-4 hover:text-emerald-950"
                  >
                    Kiểm tra hồ sơ
                  </Link>
                </div>
              ) : null}

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--public-ink)]">
                    Họ tên người khám <span className="text-[var(--public-danger)]">*</span>
                  </span>
                  <input
                    value={draft.patientName}
                    onChange={(event) =>
                      updateDraft({ patientName: event.target.value })
                    }
                    className="ui-field mt-2 w-full px-3 py-3 text-base sm:text-sm"
                    autoComplete="name"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--public-ink)]">
                    Số điện thoại nhận OTP <span className="text-[var(--public-danger)]">*</span>
                  </span>
                  <div className="relative mt-2">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--public-muted)]" aria-hidden="true" />
                    <input
                      value={draft.patientPhone}
                      onChange={(event) =>
                        updatePatientPhone(event.target.value)
                      }
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      pattern="(0|\+84)[0-9]{9,10}"
                      placeholder="0901234567"
                      className="ui-field w-full px-3 py-3 pl-9 text-base sm:text-sm"
                      required
                    />
                  </div>
                  <span className="mt-1.5 block text-xs leading-5 text-[var(--public-muted)]">Dùng số bắt đầu bằng 0 hoặc +84. Số này cũng dùng để đăng nhập xem lại lịch hẹn.</span>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--public-ink)]">
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
                    className="ui-field mt-2 w-full px-3 py-3 text-base sm:text-sm"
                  >
                    {otpChannels.includes("EMAIL") ? <option value="EMAIL">Email</option> : null}
                    {otpChannels.includes("SMS") ? <option value="SMS">SMS</option> : null}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--public-ink)]">
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
                    type="email"
                    autoComplete="email"
                    className="ui-field mt-2 w-full px-3 py-3 text-base sm:text-sm"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-sm font-semibold text-[var(--public-ink)]">
                    Lý do khám
                  </span>
                  <textarea
                    value={draft.reason}
                    onChange={(event) =>
                      updateDraft({ reason: event.target.value })
                    }
                    rows={3}
                    placeholder="Ví dụ: đau đầu, tái khám, tư vấn kết quả..."
                    className="ui-field mt-2 w-full px-3 py-3 text-base sm:text-sm"
                  />
                </label>
              </div>
            </div>

            <div className={`${flowStep === 2 ? "mt-4" : "hidden"} overflow-hidden rounded-2xl border border-[var(--public-border)] bg-white shadow-sm`}>
              <button
                type="button"
                onClick={() => setShowAdditionalInfo((current) => !current)}
                className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[var(--public-surface-muted)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[var(--public-primary-soft)]"
                aria-expanded={showAdditionalInfo}
              >
                <span>
                  <span className="block text-sm font-bold text-[var(--public-ink)]">
                    Hồ sơ y tế và BHYT
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-[var(--public-muted)]">
                    Ngày sinh, BHYT và tiền sử bệnh. Có thể nhập để hồ sơ khám
                    đầy đủ hơn.
                  </span>
                </span>
                <span className="shrink-0 rounded-lg border border-[var(--public-border)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--public-primary-dark)]">
                  {showAdditionalInfo ? "Ẩn bớt" : "Nhập thêm"}
                </span>
              </button>

              {showAdditionalInfo ? (
                <div className="grid gap-4 border-t border-[var(--public-divider)] bg-[var(--public-surface-muted)]/55 p-4 md:grid-cols-2">
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
                      className="ui-field mt-1 w-full px-3 py-2.5 text-sm"
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
                      className="ui-field mt-1 w-full px-3 py-2.5 text-sm"
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
                      className="ui-field mt-1 w-full px-3 py-2.5 text-sm"
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
                      className="ui-field mt-1 w-full px-3 py-2.5 text-sm"
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
                      <label className="block">
                        <span className="text-sm font-medium text-[var(--public-text-soft)]">Mã thẻ BHYT</span>
                        <input
                          value={draft.healthInsuranceCode}
                          onChange={(event) => updateDraft({ healthInsuranceCode: event.target.value })}
                          className="ui-field mt-1 w-full px-3 py-2.5 text-sm"
                        />
                      </label>
                      <label className="block md:col-span-2">
                        <span className="text-sm font-medium text-[var(--public-text-soft)]">Nơi đăng ký khám chữa bệnh ban đầu</span>
                        <input
                          value={draft.registeredHospital}
                          onChange={(event) => updateDraft({ registeredHospital: event.target.value })}
                          className="ui-field mt-1 w-full px-3 py-2.5 text-sm"
                        />
                      </label>
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
                      className="ui-field mt-1 w-full px-3 py-2.5 text-sm"
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
                      className="ui-field mt-1 w-full px-3 py-2.5 text-sm"
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
                      className="ui-field mt-1 w-full px-3 py-2.5 text-sm"
                    />
                  </label>
                  {hasHealthDeclaration ? (
                    <label className="flex items-start gap-2 md:col-span-2">
                      <input
                        type="checkbox"
                        checked={draft.healthConsent}
                        onChange={(event) =>
                          updateDraft({ healthConsent: event.target.checked })
                        }
                        className="mt-1 h-4 w-4"
                      />
                      <span className="text-sm text-[#334155]">
                        Tôi đồng ý cho bệnh viện lưu và sử dụng thông tin dị ứng, tiền sử
                        sức khỏe trên để phục vụ khám bệnh. Thông tin chỉ nhân sự y tế
                        có thẩm quyền được xem.
                      </span>
                    </label>
                  ) : null}
                </div>
              ) : null}
            </div>

            {error ? (
              <div
                ref={formErrorRef}
                tabIndex={-1}
                role="alert"
                className="ui-status-danger mt-5 scroll-mt-24 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-sm"
              >
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            ) : null}

            <div className={`${flowStep === 2 ? "mt-5 flex" : "hidden"} flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center`}>
              <button
                type="button"
                onClick={() => { setError(""); setFlowStep(1); }}
                className="public-button-secondary inline-flex min-h-12 shrink-0 items-center justify-center whitespace-nowrap rounded-xl px-4 py-3 text-sm font-semibold"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={() => void createAppointment()}
                disabled={submitting || loading}
                className="public-button-primary inline-flex min-h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-3 text-sm font-semibold disabled:translate-y-0 disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Giữ lịch và gửi OTP
              </button>
              <span className="min-w-0 basis-full text-sm leading-6 text-[#667892] lg:basis-auto lg:flex-1">
                Sau khi gửi mã, hệ thống sẽ hiển thị thời gian giữ khung giờ.
                Lịch chỉ chuyển sang chờ xác nhận sau khi OTP hợp lệ.{" "}
                <Link
                  href="/huong-dan/dat-lich"
                  className="font-semibold text-[#0d4f8b]"
                >
                  Cần hướng dẫn?
                </Link>
              </span>
            </div>
          </div>

          <aside
            ref={resultRef}
            tabIndex={-1}
            aria-label="Tóm tắt và xác thực lịch hẹn"
            className="scroll-mt-36 space-y-4 lg:col-span-4 lg:sticky lg:top-36 lg:self-start"
          >
            <div className="relative overflow-hidden rounded-2xl border-2 border-[var(--public-border)] bg-white p-4 shadow-[var(--public-shadow-soft)] sm:p-5">
              <span className="absolute inset-x-0 top-0 h-1.5 bg-[var(--public-primary)]" aria-hidden="true" />
              <div className="flex items-center justify-between gap-3 border-b border-[var(--public-divider)] pb-3 pt-1">
                <p className="flex items-center gap-2 font-bold text-[var(--public-ink)]">
                  <ClipboardCheck className="h-5 w-5 text-[var(--public-primary)]" aria-hidden="true" />
                  Phiếu hẹn dự kiến
                </p>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${verifiedAppointment ? "bg-[var(--public-success-soft)] text-[var(--public-success)]" : pending ? "bg-[var(--public-warning-soft)] text-[var(--public-warning)]" : "bg-[var(--public-primary-soft)] text-[var(--public-primary-dark)]"}`}>
                  {verifiedAppointment ? "Đã xác thực" : pending ? "Chờ OTP" : "Đang lập phiếu"}
                </span>
              </div>
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
                        ? `/chuyen-khoa/${selectedDepartment.slug}`
                        : `/chuyen-khoa`
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
                    selectedDoctor ? `/bac-si/${encodeURIComponent(selectedDoctor.slug || selectedDoctor.id)}` : undefined
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
                      ? `/goi-kham/${selectedPackage.slug || selectedPackage.id}`
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

            {supportHotline ? (
              <div className="rounded-2xl bg-[var(--public-primary)] p-4 text-white shadow-sm">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-white/75">Hỗ trợ đặt lịch</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold tabular-nums">{supportHotline}</p>
                    <p className="mt-1 text-xs leading-5 text-white/75">Liên hệ khi cần hướng dẫn trong quá trình đặt lịch.</p>
                  </div>
                  <a href={`tel:${supportHotline}`} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[var(--public-primary)] shadow-sm transition hover:bg-[var(--public-primary-soft)]" aria-label={`Gọi hỗ trợ ${supportHotline}`}>
                    <Phone className="h-5 w-5" aria-hidden="true" />
                  </a>
                </div>
              </div>
            ) : null}

            {message ? (
              <div className="ui-status-positive mt-4 flex items-start gap-2 rounded-xl border px-3 py-2 text-sm shadow-sm" role="status" aria-live="polite">
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
                tabIndex={-1}
                className="mt-5 scroll-mt-24 rounded-md border border-[#cfe4fa] bg-[#fbfdff] p-4 shadow-sm"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-[#0d4f8b]">
                  <ShieldCheck className="h-4 w-4" />
                  Xác thực OTP
                </div>
                {pending.holdExpiresAt ? (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--public-warning)]/30 bg-[var(--public-warning-soft)] px-3 py-2.5 text-sm">
                    <span className="inline-flex items-center gap-2 font-medium text-[var(--public-text-soft)]">
                      <TimerReset className="h-4 w-4 text-[var(--public-warning)]" aria-hidden="true" />
                      Giữ khung giờ còn
                    </span>
                    <strong className="tabular-nums text-[var(--public-warning)]" aria-live="polite">
                      {formatCountdown(holdSeconds)}
                    </strong>
                  </div>
                ) : null}
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
                      Sao chép
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
                      href={`/tai-khoan/dang-nhap?next=/tai-khoan/lich-hen&phone=${pending.patientPhone}`}
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
                <label className="mt-3 block">
                  <span className="text-xs font-semibold text-[var(--public-text-soft)]">Mã OTP gồm 6 chữ số</span>
                  <input
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    className="ui-field mt-1 w-full px-3 py-3 text-center text-xl font-semibold tracking-[0.25em]"
                  />
                </label>
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
                  disabled={submitting || resendCooldown > 0}
                  className="mt-2 w-full rounded-md border border-[#cfd8e6] px-4 py-2.5 text-sm font-medium text-[#42526b] hover:bg-[#f6f8fb] disabled:opacity-60"
                >
                  {resendCooldown > 0
                    ? `Gửi lại sau ${resendCooldown} giây`
                    : "Gửi lại OTP"}
                </button>
                <button
                  type="button"
                  onClick={() => void abandonPendingAppointment()}
                  disabled={submitting}
                  className="mt-2 w-full rounded-md border border-[var(--public-danger)]/30 px-4 py-2.5 text-sm font-semibold text-[var(--public-danger)] hover:bg-[var(--public-danger-soft)] disabled:opacity-60"
                >
                  Đổi lịch và trả khung giờ đang giữ
                </button>
                <Link
                  href={`/tai-khoan/dang-nhap?next=/tai-khoan/lich-hen&phone=${pending.patientPhone}`}
                  className="mt-2 inline-flex w-full items-center justify-center rounded-md border border-[#cfd8e6] px-4 py-2.5 text-sm font-semibold text-[#42526b] hover:bg-[#f8fafc]"
                >
                  Xác thực lại qua tra cứu
                </Link>
              </div>
            ) : null}

            {verifiedAppointment ? (
              <div
                ref={verifiedBoxRef}
                tabIndex={-1}
                role="status"
                className="mt-5 scroll-mt-24 rounded-md border border-[#bde5c8] bg-[#fbfffc] p-4 shadow-sm"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-[#1f7a3a]">
                  <CheckCircle2 className="h-4 w-4" />
                  Đã xác thực yêu cầu đặt lịch
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
                        Sao chép
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
                      {verifiedAppointment.status === "PENDING_CONFIRM"
                        ? "Chờ bệnh viện xác nhận"
                        : verifiedAppointment.status}
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
                  href={`/tai-khoan/dang-nhap?next=/tai-khoan/lich-hen&phone=${verifiedAppointment.patientPhone}`}
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
