"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { portalApi, type NotificationFilter, type ReviewInput } from "@/features/portal/api";
import { portalKeys } from "@/features/portal/keys";

// Hook dữ liệu của cổng người khám: màn hình chỉ gọi hook, không tự viết khóa cache hay đường dẫn.

export const usePortalOverview = () =>
  useQuery({ queryKey: portalKeys.overview, queryFn: portalApi.overview, staleTime: 30_000, refetchOnWindowFocus: true, refetchOnReconnect: true });

// ---- lịch hẹn ----
export const usePatientAppointments = () =>
  useQuery({ queryKey: portalKeys.appointments, queryFn: portalApi.appointments, staleTime: 20_000 });

export const usePatientAppointment = (id: string) =>
  useQuery({ queryKey: portalKeys.appointment(id), queryFn: () => portalApi.appointment(id), enabled: Boolean(id), staleTime: 15_000 });

export function useCancelAppointment(onDone?: () => void) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => portalApi.cancelAppointment(id, reason),
    onSuccess: async () => {
      onDone?.();
      // Hủy lịch đổi cả danh sách, chi tiết và tổng quan.
      await Promise.all([
        client.invalidateQueries({ queryKey: portalKeys.appointments }),
        client.invalidateQueries({ queryKey: portalKeys.overview }),
      ]);
    },
  });
}

export const useAppointmentReview = (id: string) =>
  useQuery({ queryKey: portalKeys.appointmentReview(id), queryFn: () => portalApi.appointmentReview(id), staleTime: 60_000 });

export function useSubmitReview(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ReviewInput) => portalApi.submitReview(id, input),
    onSuccess: (review) => client.setQueryData(portalKeys.appointmentReview(id), review),
  });
}

// ---- hóa đơn ----
export const usePatientInvoices = () =>
  useQuery({ queryKey: portalKeys.invoices, queryFn: portalApi.invoices, staleTime: 30_000 });

export const usePatientInvoice = (id: string) =>
  useQuery({ queryKey: portalKeys.invoice(id), queryFn: () => portalApi.invoice(id), enabled: Boolean(id), staleTime: 20_000 });

// Có liên kết cổng thanh toán thì chuyển sang đó; nếu không thì làm mới hóa đơn và tổng quan.
export function usePayInvoice(onSettled?: () => void) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ invoiceId, provider }: { invoiceId: string; provider: string }) => portalApi.payInvoice(invoiceId, provider),
    onSuccess: async (payment) => {
      if (payment.paymentUrl) {
        window.location.assign(payment.paymentUrl);
        return;
      }
      onSettled?.();
      await Promise.all([
        client.invalidateQueries({ queryKey: portalKeys.invoices }),
        client.invalidateQueries({ queryKey: portalKeys.overview }),
      ]);
    },
  });
}

// ---- hồ sơ sức khỏe ----
export const useHealthRecords = () =>
  useQuery({ queryKey: portalKeys.healthRecords, queryFn: portalApi.healthRecords, staleTime: 30_000 });

export const useMedicalRecord = (id: string) =>
  useQuery({ queryKey: portalKeys.medicalRecord(id), queryFn: () => portalApi.medicalRecord(id), enabled: Boolean(id), staleTime: 60_000 });

export const usePrescription = (id: string) =>
  useQuery({ queryKey: portalKeys.prescription(id), queryFn: () => portalApi.prescription(id), enabled: Boolean(id), staleTime: 60_000 });

// ---- hồ sơ cá nhân và người thân ----
export const usePatientProfile = () =>
  useQuery({ queryKey: portalKeys.profile, queryFn: portalApi.profile, staleTime: 30_000 });

export const usePatientDependent = (id: string) =>
  useQuery({
    queryKey: portalKeys.dependent(id),
    queryFn: async () => (await portalApi.dependents()).find((item) => item.id === id) || null,
    staleTime: 30_000,
  });

export function useUpdateProfile(onSaved?: () => void | Promise<void>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => portalApi.updateProfile(body),
    onSuccess: async () => {
      await onSaved?.();
      await Promise.all([
        client.invalidateQueries({ queryKey: portalKeys.profile }),
        client.invalidateQueries({ queryKey: portalKeys.overview }),
      ]);
    },
  });
}

export function useCreateDependent(onDone?: () => void) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => portalApi.createDependent(body),
    onSuccess: async () => {
      onDone?.();
      await client.invalidateQueries({ queryKey: portalKeys.profile });
    },
  });
}

export function useUpdateDependent(id: string, onDone?: () => void) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: unknown) => portalApi.updateDependent(id, body),
    onSuccess: async () => {
      onDone?.();
      await client.invalidateQueries({ queryKey: portalKeys.profile });
    },
  });
}

export function useArchiveDependent() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => portalApi.archiveDependent(id),
    onSuccess: () => client.invalidateQueries({ queryKey: portalKeys.profile }),
  });
}

// ---- phiên đăng nhập ----
export const usePatientSessions = () =>
  useQuery({ queryKey: portalKeys.sessions, queryFn: portalApi.sessions, staleTime: 15_000 });

export function useRevokeSession() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => portalApi.revokeSession(id),
    onSuccess: () => client.invalidateQueries({ queryKey: portalKeys.sessions }),
  });
}

// ---- thông báo ----
export const usePatientNotifications = (filter: NotificationFilter, page: number) =>
  useQuery({
    queryKey: portalKeys.notificationList(filter, page),
    queryFn: () => portalApi.notifications(filter, page),
    staleTime: 20_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

export const useUnreadNotificationCount = (enabled: boolean) =>
  useQuery({
    queryKey: portalKeys.unreadCount,
    queryFn: portalApi.unreadCount,
    enabled,
    staleTime: 30_000,
    refetchInterval: 3 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

export function useNotificationMutations() {
  const client = useQueryClient();
  // Khóa danh sách và số chưa đọc cùng nằm dưới tiền tố "notifications".
  const refresh = () => client.invalidateQueries({ queryKey: portalKeys.notifications });
  return {
    markRead: useMutation({ mutationFn: (id: string) => portalApi.markNotificationRead(id), onSuccess: refresh }),
    markAll: useMutation({ mutationFn: portalApi.markAllNotificationsRead, onSuccess: refresh }),
  };
}
