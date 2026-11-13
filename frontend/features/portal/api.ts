import { patientApiRequest, patientPortalRequest } from "@/lib/patient-portal-api";
import type {
  PatientAppointment,
  PatientDependent,
  PatientInvoice,
  PatientMedicalRecord,
  PatientNotification,
  PatientPortalOverview,
  PatientPrescription,
  PatientSession,
  PatientUser,
} from "@/lib/patient-portal-types";

// Mọi đường dẫn cổng người khám (tên tài nguyên tiếng Việt của route handler Next) chỉ khai báo ở đây.
const LIST_LIMIT = 50;

export type PaymentProvider = { provider: string; label: string };
export type PaymentResult = { id: string; paymentUrl?: string | null; status: string; transactionCode: string };
export type NotificationFilter = "all" | "unread";
export type AppointmentReview = {
  id: string;
  rating: number;
  doctorRating: number;
  serviceRating: number;
  facilityRating: number;
  comment: string | null;
  createdAt: string;
};
export type ReviewInput = { doctorRating: number; serviceRating: number; facilityRating: number; comment: string | null };

const data = async <T>(request: Promise<{ data: T }>) => (await request).data;
const json = (value: unknown) => JSON.stringify(value);

export const portalApi = {
  overview: () => data(patientApiRequest<PatientPortalOverview>("/tong-quan")),

  appointments: () => data(patientPortalRequest<PatientAppointment[]>(`/lich-hen?page=1&limit=${LIST_LIMIT}`)),
  appointment: (id: string) => data(patientPortalRequest<PatientAppointment>(`/lich-hen/${id}`)),
  cancelAppointment: (id: string, reason: string) =>
    patientPortalRequest(`/lich-hen/${id}/huy`, { method: "POST", body: json({ reason }) }),

  appointmentReview: (id: string) => data(patientPortalRequest<AppointmentReview | null>(`/lich-hen/${id}/danh-gia`)),
  submitReview: (id: string, input: ReviewInput) =>
    data(patientPortalRequest<AppointmentReview>(`/lich-hen/${id}/danh-gia`, { method: "POST", body: json(input) })),

  invoices: async () => {
    const [invoices, capabilities] = await Promise.all([
      patientPortalRequest<PatientInvoice[]>(`/hoa-don?page=1&limit=${LIST_LIMIT}`),
      patientPortalRequest<{ providers: PaymentProvider[] }>("/kha-nang-thanh-toan"),
    ]);
    return { invoices: invoices.data, providers: capabilities.data.providers };
  },
  invoice: async (id: string) => {
    const [invoice, capabilities] = await Promise.all([
      patientPortalRequest<PatientInvoice>(`/hoa-don/${id}`),
      patientPortalRequest<{ providers: PaymentProvider[] }>("/kha-nang-thanh-toan"),
    ]);
    return { invoice: invoice.data, providers: capabilities.data.providers };
  },
  // Idempotency-Key mới cho mỗi lần bấm: bấm lại sau khi lỗi mạng không tạo hai giao dịch.
  payInvoice: (invoiceId: string, provider: string) =>
    data(
      patientPortalRequest<PaymentResult>(`/hoa-don/${invoiceId}/thanh-toan`, {
        method: "POST",
        headers: { "Idempotency-Key": `web-${invoiceId}-${provider}-${Date.now()}` },
        body: json({ provider }),
      }),
    ),

  healthRecords: async () => {
    const [records, prescriptions] = await Promise.all([
      patientPortalRequest<PatientMedicalRecord[]>(`/ket-qua?page=1&limit=${LIST_LIMIT}`),
      patientPortalRequest<PatientPrescription[]>(`/don-thuoc?page=1&limit=${LIST_LIMIT}`),
    ]);
    return { records: records.data, prescriptions: prescriptions.data };
  },
  medicalRecord: (id: string) => data(patientPortalRequest<PatientMedicalRecord>(`/ket-qua/${id}`)),
  prescription: (id: string) => data(patientPortalRequest<PatientPrescription>(`/don-thuoc/${id}`)),

  profile: async () => {
    const [profile, dependents] = await Promise.all([
      patientPortalRequest<PatientUser>("/ho-so"),
      patientPortalRequest<PatientDependent[]>("/nguoi-than"),
    ]);
    return { profile: profile.data, dependents: dependents.data };
  },
  updateProfile: (body: unknown) => patientPortalRequest<PatientUser>("/ho-so", { method: "PATCH", body: json(body) }),
  dependents: () => data(patientPortalRequest<PatientDependent[]>("/nguoi-than")),
  createDependent: (body: unknown) => patientPortalRequest("/nguoi-than", { method: "POST", body: json(body) }),
  updateDependent: (id: string, body: unknown) => patientPortalRequest(`/nguoi-than/${id}`, { method: "PATCH", body: json(body) }),
  archiveDependent: (id: string) => patientPortalRequest(`/nguoi-than/${id}`, { method: "DELETE" }),

  sessions: () => data(patientPortalRequest<PatientSession[]>("/phien")),
  revokeSession: (id: string) => patientPortalRequest(`/phien/${id}`, { method: "DELETE" }),

  notifications: (filter: NotificationFilter, page: number) =>
    patientPortalRequest<PatientNotification[]>(`/thong-bao?page=${page}&limit=10${filter === "unread" ? "&unread=true" : ""}`),
  unreadCount: async () => (await patientPortalRequest<{ unreadCount: number }>("/thong-bao/so-chua-doc")).data.unreadCount,
  markNotificationRead: (id: string) => patientPortalRequest<PatientNotification>(`/thong-bao/${id}/da-doc`, { method: "PATCH" }),
  markAllNotificationsRead: () =>
    patientPortalRequest<{ updatedCount: number; unreadCount: number }>("/thong-bao/doc-tat-ca", { method: "PATCH" }),
};
