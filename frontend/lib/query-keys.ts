export const queryKeys = {
  publicHome: ["public", "home"] as const,
  publicBooking: ["public", "booking"] as const,
  publicSiteSettings: ["public", "site-settings"] as const,
  publicBanners: (filters?: { position?: string }) =>
    ["public", "banners", filters || {}] as const,
  publicFAQs: (filters?: { category?: string }) =>
    ["public", "faqs", filters || {}] as const,
  dashboardSiteSettings: ["dashboard", "site-settings"] as const,
  dashboardHomePageConfig: ["dashboard", "homepage-config"] as const,
  dashboardBanners: (filters?: { position?: string; isActive?: string }) =>
    ["dashboard", "banners", filters || {}] as const,
  dashboardFAQs: (filters?: { category?: string; isActive?: string }) =>
    ["dashboard", "faqs", filters || {}] as const,
  dashboardDepartments: (filters?: {
    search?: string;
    isActive?: string;
    page?: number;
    limit?: number;
  }) => ["dashboard", "departments", filters || {}] as const,
  dashboardDoctors: (filters?: {
    search?: string;
    departmentId?: string;
    isAvailable?: string;
    page?: number;
    limit?: number;
  }) => ["dashboard", "doctors", filters || {}] as const,
  dashboardPackages: (filters?: {
    search?: string;
    isActive?: string;
    isPopular?: string;
    page?: number;
    limit?: number;
  }) => ["dashboard", "packages", filters || {}] as const,
  dashboardDoctorSchedules: (filters?: {
    doctorId?: string;
    dayOfWeek?: string;
    isActive?: string;
    page?: number;
    limit?: number;
  }) => ["dashboard", "doctor-schedules", filters || {}] as const,
  dashboardDoctorTimeSlots: (filters?: {
    doctorId?: string;
    date?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) => ["dashboard", "doctor-time-slots", filters || {}] as const,
  dashboardScheduleChangeRequests: (filters?: {
    status?: string;
    doctorId?: string;
    page?: number;
    limit?: number;
  }) => ["dashboard", "schedule-change-requests", filters || {}] as const,
  dashboardAppointments: (filters?: {
    status?: string;
    doctorId?: string;
    date?: string;
    phone?: string;
    bookingCode?: string;
    billingState?: "PENDING_INVOICE" | "HAS_INVOICE";
    page?: number;
    limit?: number;
  }) => ["dashboard", "appointments", filters || {}] as const,
  dashboardOverview: ["dashboard", "overview"] as const,
  dashboardStatistics: (filters?: { from?: string; to?: string }) =>
    ["dashboard", "statistics", filters || {}] as const,
  dashboardDoctorOverview: (filters?: { date?: string }) =>
    ["dashboard", "doctor-overview", filters || {}] as const,
  dashboardMedicalRecords: (filters?: {
    status?: string;
    doctorId?: string;
    date?: string;
    recordCode?: string;
    page?: number;
    limit?: number;
  }) => ["dashboard", "medical-records", filters || {}] as const,
  dashboardMedicalRecord: (id?: string) =>
    ["dashboard", "medical-records", id || ""] as const,
  dashboardPrescriptions: ["dashboard", "prescriptions"] as const,
  dashboardPrescriptionsList: (filters?: {
    status?: string;
    doctorId?: string;
    prescriptionCode?: string;
    medicalRecordId?: string;
    page?: number;
    limit?: number;
  }) => ["dashboard", "prescriptions", filters || {}] as const,
  dashboardPrescription: (id?: string) =>
    ["dashboard", "prescriptions", id || ""] as const,
  dashboardInvoices: ["dashboard", "invoices"] as const,
  dashboardInvoicesList: (filters?: {
    status?: string;
    paymentMethod?: string;
    phone?: string;
    invoiceCode?: string;
    barcode?: string;
    page?: number;
    limit?: number;
  }) => ["dashboard", "invoices", filters || {}] as const,
  dashboardInvoice: (id?: string) =>
    ["dashboard", "invoices", id || ""] as const,
  dashboardUsers: (filters?: {
    role?: string;
    isActive?: string;
    page?: number;
    limit?: number;
  }) => ["dashboard", "users", filters || {}] as const,
  dashboardUploads: ["dashboard", "uploads"] as const,
  dashboardUploadsList: (filters?: {
    isUsed?: string;
    folder?: string;
    page?: number;
    limit?: number;
  }) => ["dashboard", "uploads", filters || {}] as const,
  dashboardChatbot: ["dashboard", "chatbot"] as const,
  dashboardChatbotOverview: (filters?: {
    dateFrom?: string;
    dateTo?: string;
  }) => ["dashboard", "chatbot", "overview", filters || {}] as const,
  dashboardChatbotSettings: ["dashboard", "chatbot", "settings"] as const,
  dashboardChatbotSessions: (filters?: {
    search?: string;
    guestPhone?: string;
    intent?: string;
    state?: string;
    isActive?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) => ["dashboard", "chatbot", "sessions", filters || {}] as const,
  dashboardChatbotSession: (id?: string) =>
    ["dashboard", "chatbot", "sessions", id || ""] as const,
  dashboardChatbotLogs: (filters?: {
    search?: string;
    sessionId?: string;
    guestPhone?: string;
    intent?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) => ["dashboard", "chatbot", "logs", filters || {}] as const,
  publicDepartments: (filters?: { search?: string }) =>
    ["public", "departments", filters || {}] as const,
  publicDepartmentCatalog: (filters?: {
    search?: string;
    available?: boolean;
    sort?: "POPULAR_DESC" | "NAME_ASC";
    page?: number;
    limit?: number;
  }) => ["public", "departments", "catalog", filters || {}] as const,
  publicDoctors: (filters?: {
    search?: string;
    departmentId?: string;
    departmentSlug?: string;
  }) => ["public", "doctors", filters || {}] as const,
  publicDoctorCatalog: (filters?: {
    search?: string;
    departmentId?: string;
    minExperience?: number;
    availableToday?: boolean;
    sort?: "NAME_ASC" | "EXPERIENCE_DESC";
    page?: number;
    limit?: number;
  }) => ["public", "doctors", "catalog", filters || {}] as const,
  publicPackages: (filters?: { search?: string; isPopular?: boolean }) =>
    ["public", "packages", filters || {}] as const,
  publicPackageCatalog: (filters?: {
    search?: string;
    departmentId?: string;
    isPopular?: boolean;
    isBHYTSupport?: boolean;
    sort?: "POPULAR_DESC" | "PRICE_ASC" | "PRICE_DESC" | "NAME_ASC";
    page?: number;
    limit?: number;
  }) => ["public", "packages", "catalog", filters || {}] as const,
  publicSearch: (filters?: { q?: string; type?: string; limit?: number }) =>
    ["public", "search", filters || {}] as const,
  publicAvailableSlots: (filters?: { doctorId?: string; date?: string }) =>
    ["public", "available-slots", filters || {}] as const,
  publicAppointmentLookup: (filters?: {
    bookingCode?: string;
    phone?: string;
  }) => ["public", "appointments", "lookup", filters || {}] as const,
  publicAppointmentResult: (filters?: {
    bookingCode?: string;
    phone?: string;
  }) => ["public", "appointments", "result", filters || {}] as const,
  publicPaymentTransaction: (id?: string) =>
    ["public", "payments", id || ""] as const,
  publicChatbotSettings: ["public", "chatbot", "settings"] as const,
};
