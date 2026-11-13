"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { releaseAppointmentHold, resendAppointmentOtp, verifyAppointmentOtp, createAppointment } from "@/features/booking/api";
import {
  createInitialDraft,
  estimateAmount,
  todayInVietnam,
  type BookingCatalog,
  type OtpChannel,
  type PendingAppointment,
} from "@/features/booking/model";
import { clearPendingAppointment, readPendingAppointment, writePendingAppointment } from "@/features/booking/pending-storage";
import { buildProfilePrefill, resolveUrlPrefill } from "@/features/booking/prefill";
import { useBookingStore } from "@/features/booking/store";
import { validateBooking, validateOtp, validateSchedule, validateService } from "@/features/booking/validation";
import { loadOptionalPatientSession, patientSessionQueryKey } from "@/lib/patient-session-client";
import { usePublicAvailableSlots } from "@/lib/public-slots-query";
import { usePublicCapabilities } from "@/lib/public-capabilities-query";
import { queryKeys } from "@/lib/query-keys";

const RESEND_COOLDOWN_SECONDS = 30;

const otpNotice = (bookingCode: string, status?: PendingAppointment["otpDeliveryStatus"]) => {
  if (status === "SENT") return `Đã gửi OTP xác nhận cho lịch ${bookingCode}.`;
  if (status === "FAILED") return `Chưa gửi được OTP xác nhận cho lịch ${bookingCode}. Vui lòng gửi lại OTP.`;
  return `Yêu cầu gửi OTP cho lịch ${bookingCode} đã được tiếp nhận. Vui lòng kiểm tra mã trong giây lát.`;
};

const messageOf = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

// Điều phối luồng đặt lịch: nối trạng thái (reducer), dữ liệu máy chủ (khung giờ, kênh OTP, hồ sơ)
// và các bộ đếm giờ. Không chứa giao diện.
export function useBookingFlow(catalog: BookingCatalog) {
  const queryClient = useQueryClient();
  const state = useBookingStore((store) => store.state);
  const dispatch = useBookingStore((store) => store.dispatch);
  const { selection, draft, pending } = state;

  const [holdSeconds, setHoldSeconds] = useState(0);
  const [now, setNow] = useState(0);

  const slotsQuery = usePublicAvailableSlots({ doctorId: selection.doctorId, date: draft.date });
  const slots = useMemo(() => (selection.doctorId && draft.date ? slotsQuery.data ?? [] : []), [selection.doctorId, draft.date, slotsQuery.data]);
  const slotsLoading = slotsQuery.isLoading;
  const slotsError = slotsQuery.error instanceof Error ? slotsQuery.error.message : "";

  const otpChannels = usePublicCapabilities().data?.otp.channels ?? (["EMAIL"] as OtpChannel[]);
  // Kênh đang chọn không còn khả dụng (ví dụ SMS chưa cấu hình) thì dùng kênh khả dụng đầu tiên.
  const otpChannel: OtpChannel = otpChannels.includes(draft.otpChannel) ? draft.otpChannel : otpChannels[0];

  const sessionQuery = useQuery({
    queryKey: patientSessionQueryKey,
    queryFn: loadOptionalPatientSession,
    retry: false,
    staleTime: 0,
  });
  const patient = sessionQuery.data ?? null;
  const sessionResolved = sessionQuery.isSuccess;

  const refreshSlots = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.publicAvailableSlots({ doctorId: selection.doctorId, date: draft.date }) }),
    [queryClient, selection.doctorId, draft.date],
  );

  // Ngày mặc định là hôm nay (giờ Việt Nam), điền sau khi tải để tránh lệch giữa máy chủ và trình duyệt.
  useEffect(() => dispatch({ type: "date_defaulted", date: todayInVietnam() }), [dispatch]);

  // Áp dụng tham số trên URL một lần khi danh mục đã có dữ liệu.
  const catalogReady = catalog.departments.length > 0 || catalog.doctors.length > 0 || catalog.packages.length > 0;
  useEffect(() => {
    if (state.urlApplied || !catalogReady) return;
    dispatch({ type: "url_applied", prefill: resolveUrlPrefill(new URLSearchParams(window.location.search), catalog) });
  }, [state.urlApplied, catalogReady, catalog, dispatch]);

  // Khôi phục phiếu chờ OTP sau khi tải lại trang.
  useEffect(() => {
    if (useBookingStore.getState().state.pending) return;
    const restored = readPendingAppointment();
    if (!restored) return;
    const expiresAt = restored.holdExpiresAt ? new Date(restored.holdExpiresAt).getTime() : 0;
    if (expiresAt && expiresAt <= Date.now()) {
      clearPendingAppointment();
      dispatch({ type: "hold_expired", message: "Phiên giữ khung giờ trước đó đã hết hạn. Vui lòng chọn lại khung giờ." });
      return;
    }
    dispatch({
      type: "pending_restored",
      pending: restored,
      notice: `Đã khôi phục phiên xác thực cho lịch ${restored.bookingCode}.`,
      resendAt: Date.now() + RESEND_COOLDOWN_SECONDS * 1000,
    });
  }, [dispatch]);

  useEffect(() => {
    if (pending) writePendingAppointment(pending);
  }, [pending]);

  // Đếm ngược thời gian giữ khung giờ; hết giờ thì bỏ phiếu và làm mới khung giờ trống.
  const holdExpiresAt = pending?.holdExpiresAt ?? null;
  useEffect(() => {
    if (!holdExpiresAt) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((new Date(holdExpiresAt).getTime() - Date.now()) / 1000));
      setHoldSeconds(remaining);
      if (remaining === 0) {
        clearPendingAppointment();
        dispatch({ type: "hold_expired", message: "Thời gian giữ khung giờ đã hết. Vui lòng chọn lại khung giờ để tiếp tục." });
        void refreshSlots();
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [holdExpiresAt, dispatch, refreshSlots]);

  // Đồng hồ nhịp 1 giây chỉ chạy khi đang chờ được gửi lại OTP.
  const resendAt = state.resendAt;
  useEffect(() => {
    if (!resendAt) return;
    const id = window.setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= resendAt) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendAt]);
  // Trước nhịp đầu tiên coi như còn đủ thời gian chờ (resendAt vừa được đặt).
  const resendCooldown = resendAt ? Math.max(0, Math.ceil((resendAt - (now || resendAt - RESEND_COOLDOWN_SECONDS * 1000)) / 1000)) : 0;

  // Đồng bộ khung giờ đã chọn với danh sách mới: giờ không còn trống thì bỏ chọn.
  useEffect(() => {
    if (slotsQuery.data && selection.doctorId && draft.date) dispatch({ type: "slots_loaded", slots: slotsQuery.data });
  }, [slotsQuery.data, selection.doctorId, draft.date, dispatch]);

  // Tự điền từ hồ sơ tài khoản khi đăng nhập; đăng xuất thì xóa phần đã tự điền.
  useEffect(() => {
    const current = useBookingStore.getState().state;
    if (patient) {
      if (current.profileOwnerId === patient.id) return;
      // Đổi sang tài khoản khác: tự điền lại từ đầu, chỉ giữ ngày và giờ đã chọn.
      const switched = Boolean(current.profileOwnerId);
      const base = switched ? { ...createInitialDraft(current.draft.date), timeSlotId: current.draft.timeSlotId } : current.draft;
      dispatch({ type: "profile_applied", ownerId: patient.id, patch: buildProfilePrefill(base, patient) });
    } else if (sessionResolved) {
      dispatch({ type: "profile_cleared" });
    }
  }, [patient, sessionResolved, dispatch]);

  const profilePrefilled = Boolean(
    patient && ((patient.fullName && draft.patientName === patient.fullName) || (patient.phone && draft.patientPhone === patient.phone)),
  );

  // ---- hành động ----
  const fail = useCallback((message: string) => dispatch({ type: "error", message }), [dispatch]);

  const continueFromService = useCallback(() => {
    const error = validateService(selection);
    if (error) return fail(error);
    dispatch({ type: "step_changed", step: "schedule" });
  }, [selection, dispatch, fail]);

  const continueFromSchedule = useCallback(() => {
    const error = validateSchedule(draft, todayInVietnam());
    if (error) return fail(error);
    dispatch({ type: "step_changed", step: "details" });
  }, [draft, dispatch, fail]);

  const goToStep = useCallback((step: "service" | "schedule" | "details") => dispatch({ type: "step_changed", step }), [dispatch]);

  const submitDetails = useCallback(async () => {
    const today = todayInVietnam();
    const error = validateBooking(selection, { ...draft, otpChannel }, today);
    if (error) return fail(error);

    dispatch({ type: "submitting", value: true });
    try {
      const result = await createAppointment(selection, draft, otpChannel);
      dispatch({
        type: "hold_created",
        pending: result,
        notice: otpNotice(result.bookingCode, result.otpDeliveryStatus),
        resendAt: Date.now() + RESEND_COOLDOWN_SECONDS * 1000,
      });
      void refreshSlots();
    } catch (err) {
      fail(messageOf(err, "Không tạo được lịch hẹn"));
    }
  }, [selection, draft, otpChannel, dispatch, fail, refreshSlots]);

  const verifyOtp = useCallback(async () => {
    if (!pending) return;
    const error = validateOtp(state.otp);
    if (error) return fail(error);

    dispatch({ type: "submitting", value: true });
    try {
      const appointment = await verifyAppointmentOtp(pending.appointmentId, state.otp);
      clearPendingAppointment();
      dispatch({ type: "verified", appointment, notice: "Xác thực OTP thành công. Lịch hẹn đang chờ bệnh viện xác nhận." });
      void refreshSlots();
    } catch (err) {
      fail(messageOf(err, "Xác thực OTP thất bại"));
    }
  }, [pending, state.otp, dispatch, fail, refreshSlots]);

  const resendOtp = useCallback(async () => {
    if (!pending) return;
    dispatch({ type: "submitting", value: true });
    try {
      const result = await resendAppointmentOtp(pending.appointmentId);
      dispatch({
        type: "otp_resent",
        resendAt: Date.now() + RESEND_COOLDOWN_SECONDS * 1000,
        patch: {
          expiresIn: result.expiresIn,
          otpDeliveryStatus: result.otpDeliveryStatus,
          debugOtp: result.debugOtp,
          holdExpiresAt: result.holdExpiresAt,
        },
        notice: otpNotice(pending.bookingCode, result.otpDeliveryStatus),
      });
    } catch (err) {
      fail(messageOf(err, "Không gửi lại được OTP"));
    }
  }, [pending, dispatch, fail]);

  const abandonPending = useCallback(async () => {
    if (!pending || state.submitting) return;
    dispatch({ type: "submitting", value: true });
    try {
      await releaseAppointmentHold(pending);
      clearPendingAppointment();
      setHoldSeconds(0);
      dispatch({
        type: "hold_released",
        notice: pending.holdReleaseToken
          ? "Đã trả khung giờ. Vui lòng chọn thời gian khác để tiếp tục."
          : "Đã đóng phiên xác thực cũ. Vui lòng chọn lại khung giờ.",
      });
      void refreshSlots();
    } catch (err) {
      fail(messageOf(err, "Không thể trả khung giờ lúc này. Vui lòng thử lại."));
    }
  }, [pending, state.submitting, dispatch, fail, refreshSlots]);

  const startNewBooking = useCallback(() => {
    clearPendingAppointment();
    dispatch({ type: "reset" });
    dispatch({ type: "date_defaulted", date: todayInVietnam() });
  }, [dispatch]);

  return {
    state,
    dispatch,
    catalog,
    slots,
    slotsLoading,
    slotsError,
    otpChannels,
    otpChannel,
    patient,
    profilePrefilled,
    holdSeconds,
    resendCooldown,
    amount: estimateAmount(selection, catalog),
    actions: { continueFromService, continueFromSchedule, goToStep, submitDetails, verifyOtp, resendOtp, abandonPending, startNewBooking },
  };
}

export type BookingFlow = ReturnType<typeof useBookingFlow>;
