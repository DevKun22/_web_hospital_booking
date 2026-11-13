// Toàn bộ khóa cache của cổng người khám bắt đầu bằng "patient", nên sau khi dữ liệu đổi
// (hủy lịch, thanh toán, sửa hồ sơ) có thể làm mới theo tiền tố mà không sót màn hình nào.
export const portalKeys = {
  all: ["patient"] as const,
  overview: ["patient", "overview"] as const,
  appointments: ["patient", "appointments"] as const,
  appointment: (id: string) => ["patient", "appointments", id] as const,
  appointmentReview: (id: string) => ["patient", "appointments", id, "review"] as const,
  invoices: ["patient", "invoices"] as const,
  invoice: (id: string) => ["patient", "invoices", id] as const,
  healthRecords: ["patient", "health-records"] as const,
  medicalRecord: (id: string) => ["patient", "health-records", "record", id] as const,
  prescription: (id: string) => ["patient", "health-records", "prescription", id] as const,
  profile: ["patient", "profile"] as const,
  dependent: (id: string) => ["patient", "profile", "dependent", id] as const,
  sessions: ["patient", "sessions"] as const,
  notifications: ["patient", "notifications"] as const,
  notificationList: (filter: string, page: number) => ["patient", "notifications", "list", filter, page] as const,
  unreadCount: ["patient", "notifications", "unread-count"] as const,
};
