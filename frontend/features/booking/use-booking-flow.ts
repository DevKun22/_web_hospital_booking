"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { releaseAppointmentHold, resendAppointmentOtp, verifyAppointmentOtp, createAppointment } from "@/features/booking/api";
import {
  createInitialDraft,
  estimateAmount,
  todayInVietnam,
  type BookingCatalog,
  type PendingAppointment,
} from "@/features/booking/model";
import { clearPendingAppointment, readPendingAppointment, writePendingAppointment } from "@/features/booking/pending-storage";
import { buildDependentPatch, buildProfilePrefill, buildSelfPatch, resolveUrlPrefill } from "@/features/booking/prefill";
import { useBookingStore } from "@/features/booking/store";
import { validateDetailFields, validateOtp, validateSchedule, validateService } from "@/features/booking/validation";
import { portalApi } from "@/features/portal/api";
import { portalKeys } from "@/features/portal/keys";
import type { PatientDependent } from "@/lib/patient-portal-types";
import { loadOptionalPatientSession, patientSessionQueryKey } from "@/lib/patient-session-client";
import { usePublicAvailableSlots } from "@/lib/public-slots-query";
import { usePublicCapabilities } from "@/lib/public-capabilities-query";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/lib/api";
import { legalQueryKey, useLegal } from "@/lib/legal";

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

  // OTP chỉ gửi qua email; false khi backend chưa cấu hình dịch vụ gửi thư (mặc định coi là khả dụng cho tới khi biết).
  const emailOtpAvailable = usePublicCapabilities().data?.otp.emailOtpAvailable ?? true;

  const terms = useLegal().data?.terms ?? null;

  const sessionQuery = useQuery({
    queryKey: patientSessionQueryKey,
    queryFn: loadOptionalPatientSession,
    retry: false,
    staleTime: 0,
  });
  const patient = sessionQuery.data ?? null;
  const sessionResolved = sessionQuery.isSuccess;

  // Hồ sơ người thân của tài khoản đang đăng nhập (cùng khóa gốc với trang Hồ sơ nên thêm hoặc xóa ở đó cũng làm mới ở đây).
  const dependentsQuery = useQuery({
    queryKey: [...portalKeys.profile, "dependents"],
    queryFn: portalApi.dependents,
    enabled: Boolean(patient),
    staleTime: 30_000,
  });
  const dependents = useMemo(() => (patient ? dependentsQuery.data ?? [] : []), [patient, dependentsQuery.data]);

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

  const profilePrefilled = !selection.dependentId && Boolean(
    patient && ((patient.fullName && draft.patientName === patient.fullName) || (patient.email && draft.patientEmail === patient.email)),
  );

  // ---- hành động ----
  const fail = useCallback((message: string) => dispatch({ type: "error", message }), [dispatch]);

  // Chọn người khám: "" là bản thân, ngược lại là mã hồ sơ người thân.
  const choosePerson = useCallback(
    (dependentId: string, list: PatientDependent[] = dependents) => {
      if (!patient) return;
      const dependent = dependentId ? list.find((item) => item.id === dependentId) : null;
      if (dependentId && !dependent) return;
      const current = useBookingStore.getState().state.draft;
      dispatch({ type: "person_chosen", dependentId, patch: dependent ? buildDependentPatch(dependent, patient) : buildSelfPatch(current, patient) });
    },
    [patient, dependents, dispatch],
  );

  // Thêm nhanh một người thân rồi chọn luôn; lỗi trả về để form hiện tại chỗ.
  const addDependent = useCallback(
    async (body: { fullName: string; relationship: string; dateOfBirth: string | null }) => {
      const created = (await portalApi.createDependent({ ...body, gender: null, hasBHYT: false, consentConfirmed: true })).data as PatientDependent;
      await queryClient.invalidateQueries({ queryKey: portalKeys.profile });
      choosePerson(created.id, [created]);
    },
    [queryClient, choosePerson],
  );

  const continueFromService = useCallback(() => {
    const error = validateService(selection);
    if (error) return dispatch({ type: "step_invalid", message: error });
    dispatch({ type: "step_changed", step: "schedule" });
  }, [selection, dispatch]);

  const continueFromSchedule = useCallback(() => {
    const error = validateSchedule(draft, todayInVietnam());
    if (error) return dispatch({ type: "step_invalid", message: error });
    dispatch({ type: "step_changed", step: "details" });
  }, [draft, dispatch]);

  const goToStep = useCallback((step: "service" | "schedule" | "details") => dispatch({ type: "step_changed", step }), [dispatch]);

  // Chặn gửi lặp: `state.submitting` chỉ đổi sau khi giao diện vẽ lại nên bấm đúp rất nhanh vẫn lọt hai yêu cầu; cờ này đổi ngay.
  const submitInFlight = useRef(false);

  const submitDetails = useCallback(async () => {
    if (submitInFlight.current) return;
    const today = todayInVietnam();
    // Thiếu lựa chọn ở các bước trước là hiếm (đã chặn ở từng bước): báo bằng thông báo nổi. Lỗi nhập liệu thì hiện tại từng ô.
    const earlier = validateService(selection) || validateSchedule(draft, today);
    if (earlier) return fail(earlier);
    // Khách chưa đăng nhập phải đồng ý điều khoản (nếu cơ sở đã soạn) trước khi nhận OTP; người đã đăng nhập đã đồng ý lúc đăng nhập.
    const needsTerms = !patient && Boolean(terms);
    if (Object.keys(validateDetailFields(draft, today)).length > 0 || (needsTerms && !draft.termsAccepted)) {
      dispatch({ type: "submit_failed" });
      return;
    }

    submitInFlight.current = true;
    dispatch({ type: "submitting", value: true });
    try {
      const result = await createAppointment(selection, draft, needsTerms ? { termsAccepted: true, termsVersion: terms!.version } : undefined);
      dispatch({
        type: "hold_created",
        pending: result,
        notice: otpNotice(result.bookingCode, result.otpDeliveryStatus),
        resendAt: Date.now() + RESEND_COOLDOWN_SECONDS * 1000,
      });
      void refreshSlots();
    } catch (err) {
      if (err instanceof ApiError && err.code === "TERMS_OUTDATED") {
        // Điều khoản vừa được cập nhật: tải lại bản mới và bắt đồng ý lại.
        dispatch({ type: "draft_changed", patch: { termsAccepted: false } });
        void queryClient.invalidateQueries({ queryKey: legalQueryKey });
        fail(err.message);
      } else if (err instanceof ApiError && err.code === "EMAIL_UNAVAILABLE") {
        // Lỗi của riêng ô Email: hiện ngay dưới ô (có focus) thay vì thông báo nổi tự tắt.
        dispatch({ type: "email_rejected", message: err.message });
      } else if (err instanceof ApiError && err.status === 429) {
        // Bị giới hạn tần suất: khóa nút và đếm ngược đúng số giây máy chủ yêu cầu chờ.
        const seconds = err.retryAfterSeconds ?? 60;
        dispatch({ type: "rate_limited", until: Date.now() + seconds * 1000, message: err.message });
      } else {
        fail(messageOf(err, "Không tạo được lịch hẹn"));
      }
    } finally {
      submitInFlight.current = false;
    }
  }, [selection, draft, patient, terms, queryClient, dispatch, fail, refreshSlots]);

  const verifyOtp = useCallback(async () => {
    if (!pending) return;
    const error = validateOtp(state.otp);
    if (error) return dispatch({ type: "otp_error", message: error });

    dispatch({ type: "submitting", value: true });
    try {
      const { appointment, user } = await verifyAppointmentOtp(pending.appointmentId, state.otp);
      // Máy chủ đã đăng nhập cổng người khám bằng cookie: cập nhật phiên để nút "Xem lịch của tôi" vào thẳng cổng.
      if (user) queryClient.setQueryData(patientSessionQueryKey, user);
      clearPendingAppointment();
      dispatch({ type: "verified", appointment, notice: "" });
      void refreshSlots();
    } catch (err) {
      // Mã sai hoặc hết hạn là lỗi của ô nhập mã: hiện ngay dưới ô. Lỗi mạng, giới hạn tần suất hoặc máy chủ thì dùng thông báo nổi.
      const message = messageOf(err, "Xác thực OTP thất bại");
      if (err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 429) dispatch({ type: "otp_error", message });
      else fail(message);
    }
  }, [pending, state.otp, dispatch, fail, refreshSlots, queryClient]);

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
    emailOtpAvailable,
    patient,
    dependents,
    dependentsLoading: dependentsQuery.isLoading,
    profilePrefilled,
    termsRequired: !patient && Boolean(terms),
    holdSeconds,
    resendCooldown,
    amount: estimateAmount(selection, catalog),
    actions: { choosePerson, addDependent, continueFromService, continueFromSchedule, goToStep, submitDetails, verifyOtp, resendOtp, abandonPending, startNewBooking },
  };
}

export type BookingFlow = ReturnType<typeof useBookingFlow>;
