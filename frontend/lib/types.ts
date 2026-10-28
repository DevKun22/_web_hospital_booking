export type DashboardRole = "ADMIN" | "STAFF" | "DOCTOR";

export type ConsultationStatus =
  | "NEW"
  | "CONTACTED"
  | "CANCELLED"
  | "COMPLETED";

export type DashboardUser = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  role: DashboardRole;
  avatar: string | null;
  isActive?: boolean;
  isPhoneVerified?: boolean;
  isEmailVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type Department = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  image: string | null;
  symptomKeywords: string[];
  triageDescription: string | null;
  isTriageFallback: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    doctors: number;
    appointments: number;
  };
};

export type DoctorProfile = {
  id: string;
  slug: string;
  title: string | null;
  bio: string | null;
  specialization: string | null;
  experience: number | null;
  consultationFee: number;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    avatar: string | null;
    isActive: boolean;
  };
  department: {
    id: string;
    name: string;
    slug: string | null;
    isActive: boolean;
  };
  _count: {
    appointments: number;
    schedules: number;
    timeSlots: number;
  };
  reviewSummary?: {
    count: number;
    averageRating: number;
    averageDoctorRating: number;
    averageServiceRating: number;
    averageFacilityRating: number;
  };
  publicReviews?: {
    id: string;
    rating: number;
    doctorRating: number;
    serviceRating: number;
    facilityRating: number;
    comment: string | null;
    createdAt: string;
  }[];
};

export type PackageItem = {
  id: string;
  packageId: string;
  name: string;
  description: string | null;
  price: number;
  included: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type MedicalPackage = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  departmentId: string | null;
  department: {
    id: string;
    name: string;
    slug: string | null;
    isActive: boolean;
  } | null;
  basePrice: number;
  serviceFee: number;
  includedItemsTotal?: number;
  finalPrice: number;
  summary: string | null;
  note: string | null;
  isPopular: boolean;
  isBHYTSupport: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  items: PackageItem[];
  _count: {
    appointments: number;
  };
};

export type DoctorSchedule = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDuration: number;
  maxPatients: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  doctor: {
    id: string;
    userId: string;
    title: string | null;
    specialization: string | null;
    user: {
      fullName: string;
      avatar: string | null;
    };
    department: {
      id: string;
      name: string;
      slug: string | null;
    };
  };
};

export type TimeSlotStatus = "AVAILABLE" | "BOOKED" | "LOCKED" | "CANCELLED";

export type DoctorTimeSlot = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: TimeSlotStatus;
  isActive: boolean;
  lockReason: string | null;
  createdAt: string;
  updatedAt: string;
  appointment: {
    id: string;
    bookingCode: string;
    status: string;
  } | null;
  doctor: DoctorSchedule["doctor"];
};

export type ScheduleChangeRequestType =
  | "CREATE_WEEKLY_SCHEDULE"
  | "UPDATE_WEEKLY_SCHEDULE"
  | "DEACTIVATE_WEEKLY_SCHEDULE";
export type ScheduleChangeRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export type ScheduleChangeRequest = {
  id: string;
  type: ScheduleChangeRequestType;
  status: ScheduleChangeRequestStatus;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDuration: number;
  maxPatients: number;
  isActive: boolean;
  effectiveFrom: string;
  reason: string;
  reviewerNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  schedule: Pick<
    DoctorSchedule,
    "id" | "dayOfWeek" | "startTime" | "endTime" | "isActive"
  > | null;
  doctor: Pick<DoctorSchedule["doctor"], "id" | "title"> & {
    user: Pick<DoctorSchedule["doctor"]["user"], "fullName" | "avatar">;
    department: Pick<DoctorSchedule["doctor"]["department"], "id" | "name">;
  };
  requestedBy: { id: string; fullName: string };
  reviewedBy: { id: string; fullName: string } | null;
};
export type AppointmentStatus =
  | "PENDING_OTP"
  | "PENDING_CONFIRM"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "RESCHEDULED"
  | "CANCELLED_BY_PATIENT"
  | "CANCELLED_BY_DOCTOR"
  | "CANCELLED_BY_ADMIN"
  | "NO_SHOW";

export type Appointment = {
  id: string;
  bookingCode: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  reason: string | null;
  patientName: string;
  patientPhone: string;
  patientEmail: string | null;
  patientGender: "MALE" | "FEMALE" | "OTHER" | null;
  patientDateOfBirth: string | null;
  patientAddress: string | null;
  patientCccd: string | null;
  hasBHYT: boolean;
  healthInsuranceCode: string | null;
  registeredHospital: string | null;
  allergies: string | null;
  medicalHistory: string | null;
  familyHistory: string | null;
  estimatedPrice: number;
  serviceFee: number;
  bhytDiscount: number;
  finalAmount: number;
  confirmedAt: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  patient: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
    isPhoneVerified: boolean;
  };
  doctor: {
    id: string;
    title: string | null;
    specialization: string | null;
    consultationFee: number;
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
    basePrice: number;
    serviceFee: number;
  } | null;
  timeSlot: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
  } | null;
  invoice: PublicAppointmentInvoice | null;
};

export type InvoiceStatus = "UNPAID" | "PAID" | "CANCELLED" | "REFUNDED";
export type InvoiceItemType =
  | "CONSULTATION"
  | "PACKAGE"
  | "SERVICE_FEE"
  | "OTHER";
export type InvoiceItem = {
  id: string;
  type: InvoiceItemType;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  sortOrder: number;
};
export type PaymentMethod =
  | "CASH"
  | "CARD"
  | "BANK_TRANSFER"
  | "MOMO"
  | "VNPAY"
  | "OTHER";
export type PaymentProvider = "MOCK" | "VNPAY" | "MOMO" | "ZALOPAY";
export type PaymentTransactionStatus =
  | "PENDING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED";
export type InsuranceRouteType =
  | "RIGHT_ROUTE"
  | "WRONG_ROUTE"
  | "REFERRAL"
  | "EMERGENCY"
  | "SERVICE";

export type PublicInvoicePaymentTransaction = {
  id: string;
  provider: PaymentProvider;
  status: PaymentTransactionStatus;
  amount: number;
  transactionCode: string;
  paymentUrl: string | null;
  paidAt: string | null;
  expiredAt: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicAppointmentInvoice = {
  id: string;
  invoiceCode: string;
  barcode: string;
  totalAmount: number;
  bhytDiscount: number;
  finalAmount: number;
  insuranceEligibleAmount: number;
  insuranceCoverageRate: number;
  insuranceDiscountAmount: number;
  insuranceRouteType: InsuranceRouteType | null;
  insuranceNote: string | null;
  status: InvoiceStatus;
  paymentMethod: PaymentMethod | null;
  paymentReference: string | null;
  paidAt: string | null;
  refundReason: string | null;
  refundReference: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: InvoiceItem[];
  paymentTransactions: PublicInvoicePaymentTransaction[];
};

export type PaymentTransaction = PublicInvoicePaymentTransaction & {
  providerOrderId: string | null;
  rawResponse: unknown;
  invoice: {
    id: string;
    invoiceCode: string;
    barcode: string;
    totalAmount: number;
    bhytDiscount: number;
    finalAmount: number;
    insuranceEligibleAmount: number;
    insuranceCoverageRate: number;
    insuranceDiscountAmount: number;
    insuranceRouteType: InsuranceRouteType | null;
    insuranceNote: string | null;
    status: InvoiceStatus;
    paymentMethod: PaymentMethod | null;
    paidAt: string | null;
    appointment: {
      id: string;
      bookingCode: string;
      patientName: string;
      patientPhone: string;
    };
  };
};

export type Invoice = {
  id: string;
  invoiceCode: string;
  barcode: string;
  totalAmount: number;
  bhytDiscount: number;
  finalAmount: number;
  insuranceEligibleAmount: number;
  insuranceCoverageRate: number;
  insuranceDiscountAmount: number;
  insuranceRouteType: InsuranceRouteType | null;
  insuranceNote: string | null;
  status: InvoiceStatus;
  paymentMethod: PaymentMethod | null;
  paymentReference: string | null;
  paidAt: string | null;
  refundReason: string | null;
  refundReference: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: InvoiceItem[];
  paymentTransactions: Array<{
    id: string;
    provider: PaymentProvider;
    status: PaymentTransactionStatus;
    amount: number;
    transactionCode: string;
    providerOrderId: string | null;
    paidAt: string | null;
    expiredAt: string;
    createdAt: string;
    updatedAt: string;
  }>;
  patient: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
  };
  appointment: {
    id: string;
    bookingCode: string;
    appointmentDate: string;
    startTime: string;
    endTime: string;
    status: AppointmentStatus;
    patientName: string;
    patientPhone: string;
    patientEmail: string | null;
    estimatedPrice: number;
    serviceFee: number;
    bhytDiscount: number;
    finalAmount: number;
    package: {
      id: string;
      name: string;
      slug: string | null;
      isBHYTSupport?: boolean;
    } | null;
    doctor: Appointment["doctor"];
    department: Appointment["department"];
  };
};

export type MedicalResultStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type LabResult = {
  id: string;
  medicalRecordId: string;
  testName: string;
  resultValue: string | null;
  unit: string | null;
  referenceRange: string | null;
  conclusion: string | null;
  fileUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PrescriptionSummary = {
  id: string;
  prescriptionCode: string;
  status: "DRAFT" | "ISSUED" | "CANCELLED";
  note: string | null;
  issuedAt: string | null;
  cancelledAt: string | null;
  items: unknown[];
};

export type PrescriptionStatus = "DRAFT" | "ISSUED" | "CANCELLED";

export type PrescriptionItem = {
  id: string;
  prescriptionId: string;
  medicineName: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  quantity: number | null;
  unit: string | null;
  instruction: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type Prescription = {
  id: string;
  prescriptionCode: string;
  status: PrescriptionStatus;
  note: string | null;
  issuedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  patient: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
  };
  doctor: MedicalRecord["doctor"];
  appointment: MedicalRecord["appointment"];
  medicalRecord: {
    id: string;
    recordCode: string;
    status: MedicalResultStatus;
    diagnosis: string | null;
    treatment: string | null;
  };
  items: PrescriptionItem[];
};

export type MedicalRecord = {
  id: string;
  recordCode: string;
  symptoms: string | null;
  diagnosis: string | null;
  treatment: string | null;
  prescription: string | null;
  doctorNotes: string | null;
  status: MedicalResultStatus;
  resultPdfUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  patient: {
    id: string;
    fullName: string;
    phone: string | null;
    email: string | null;
  };
  doctor: {
    id: string;
    userId: string;
    title: string | null;
    specialization: string | null;
    user: {
      fullName: string;
      avatar: string | null;
    };
    department: {
      id: string;
      name: string;
      slug: string | null;
    };
  };
  appointment: {
    id: string;
    bookingCode: string;
    appointmentDate: string;
    startTime: string;
    endTime: string;
    status: AppointmentStatus;
    patientName: string;
    patientPhone: string;
    reason: string | null;
  };
  labResults: LabResult[];
  prescriptionRecord: PrescriptionSummary | null;
};

export type ChatbotRuntimeValue = {
  aiEnabled: boolean;
  fallbackEnabled: boolean;
  faqEnabled: boolean;
  model: string;
  maxSuggestedActions: number;
  sessionExpiresDays: number;
};

export type ChatbotSettings = {
  id: string;
  key: string;
  value: ChatbotRuntimeValue;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ChatbotFAQ = {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ChatbotParticipant = {
  id: string;
  fullName: string;
  phone: string | null;
  role: DashboardRole;
} | null;

export type ChatbotLog = {
  id: string;
  sessionId: string | null;
  guestPhone: string | null;
  message: string;
  response: string;
  intent: string | null;
  createdAt: string;
  user: ChatbotParticipant;
};

export type ChatbotSession = {
  id: string;
  userId: string | null;
  guestPhone: string | null;
  draft: unknown;
  currentIntent: string | null;
  currentState: string | null;
  lastActions: unknown;
  lastMessage: string | null;
  lastResponse: string | null;
  isActive: boolean;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  user: ChatbotParticipant;
  _count: {
    logs: number;
  };
};

export type ChatbotSessionDetail = ChatbotSession & {
  logs: ChatbotLog[];
};

export type ChatbotOverview = {
  metrics: {
    totalSessions: number;
    activeSessions: number;
    totalLogs: number;
  };
  intents: { intent: string | null; count: number }[];
  states: { state: string | null; count: number }[];
  latestSessions: ChatbotSession[];
};

export type ChatBookingDraft = {
  departmentId?: string;
  departmentSlug?: string;
  packageId?: string;
  packageSlug?: string;
  serviceMode?: "DOCTOR_ONLY" | "PACKAGE";
  doctorId?: string;
  date?: string;
  timeSlotId?: string;
  symptoms?: string[];
  bodyParts?: string[];
  symptomDuration?: string;
  symptomSeverity?: "MILD" | "MODERATE" | "SEVERE" | "UNKNOWN";
  associatedSymptoms?: string[];
  triageLastQuestion?: string;
  reason?: string;
};

export type ChatbotSuggestedAction = {
  type: string;
  label: string;
  payload: Record<string, unknown>;
};

export type ChatbotResultItem =
  | {
      type: "department";
      id: string;
      name: string;
      slug?: string | null;
      description?: string | null;
    }
  | {
      type: "package";
      id: string;
      name: string;
      slug?: string | null;
      departmentId?: string | null;
      departmentName?: string | null;
      summary?: string | null;
      finalPrice: number;
    }
  | {
      type: "doctor";
      id: string;
      fullName: string;
      title?: string | null;
      specialization?: string | null;
      departmentId: string;
      departmentName: string;
      consultationFee: number;
    }
  | {
      type: "slot";
      id: string;
      doctorId: string;
      doctorName?: string;
      departmentName?: string;
      date: string;
      startTime: string;
      endTime: string;
    };

export type ChatbotResultGroup = {
  type: "departments" | "packages" | "doctors" | "slots";
  title: string;
  description?: string;
  items: ChatbotResultItem[];
  total: number;
  limit: number;
};
export type ChatbotResponseSource = "SYSTEM" | "FAQ" | "AI" | "FALLBACK" | "EMERGENCY";

export type ChatbotMessageResponse = {
  sessionId: string;
  source: ChatbotResponseSource;
  reply: string;
  intent: string;
  state: string;
  nextStep: string;
  confidence: number;
  draft: ChatBookingDraft;
  results?: ChatbotResultGroup[];
  suggestedActions: ChatbotSuggestedAction[];
};

export type StatisticsRange = {
  from: string;
  to: string;
};

export type StatisticsAppointmentSummary = Pick<
  Appointment,
  | "id"
  | "bookingCode"
  | "appointmentDate"
  | "startTime"
  | "endTime"
  | "status"
  | "patientName"
  | "patientPhone"
> & {
  doctor: {
    title: string | null;
    user: {
      fullName: string;
    };
  };
  department: {
    name: string;
  };
};

export type DashboardStatisticsOverview = {
  range: StatisticsRange;
  metrics: {
    totalAppointments: number;
    pendingConfirmAppointments: number;
    todayAppointments: number;
    completedAppointments: number;
    cancelledAppointments: number;
    newPatients: number;
    unpaidInvoices: number;
    consultationRequests: number;
    pendingConsultationRequests: number;
    completedWithoutInvoiceAppointments: number;
    collectedAmount: number;
    refundedAmount: number;
    netAmount: number;
  };
  searchAnalytics: {
    metrics: {
      totalSearches: number;
      emptySearches: number;
      successRate: number;
    };
    topKeywords: { keyword: string; normalized: string; count: number }[];
    emptyKeywords: { keyword: string; normalized: string; count: number }[];
    byType: { type: string; count: number }[];
    bySource: { source: string; count: number }[];
  };
  latestAppointments: StatisticsAppointmentSummary[];
};

export type DashboardAppointmentStatistics = {
  range: StatisticsRange;
  metrics: {
    total: number;
  };
  byStatus: { value: AppointmentStatus; count: number }[];
  daily: {
    date: string;
    total: number;
    completed: number;
    cancelled: number;
  }[];
};

export type DashboardRevenueStatistics = {
  range: StatisticsRange;
  metrics: {
    collectedAmount: number;
    refundedAmount: number;
    netAmount: number;
    invoiceCount: number;
  };
  byStatus: { status: InvoiceStatus; count: number; amount: number }[];
  byPaymentMethod: {
    paymentMethod: PaymentMethod;
    count: number;
    amount: number;
  }[];
  daily: {
    date: string;
    collectedAmount: number;
    refundedAmount: number;
    netAmount: number;
  }[];
};

export type DashboardDoctorStatistics = {
  range: StatisticsRange;
  items: {
    doctor: Pick<DoctorProfile, "id" | "title" | "specialization"> & {
      user: {
        fullName: string;
        avatar: string | null;
      };
      department: {
        id: string;
        name: string;
        slug: string | null;
      };
    };
    appointmentCount: number;
    slots: { status: TimeSlotStatus; count: number }[];
  }[];
};

export type DashboardDepartmentStatistics = {
  range: StatisticsRange;
  items: {
    department: {
      id: string;
      name: string;
      slug: string | null;
      isActive: boolean;
      _count: {
        doctors: number;
        packages: number;
      };
    } | null;
    appointmentCount: number;
    estimatedAmount: number;
  }[];
  activeDepartments: number;
  totalDepartments: number;
};

export type ListResult<T> = {
  items: T[];
  pagination: Pagination;
};

export type ConsultationRequest = {
  id: string;
  phone: string;
  fullName: string | null;
  message: string | null;
  status: ConsultationStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MediaAsset = {
  id: string;
  url: string;
  publicId: string;
  folder: string;
  mimeType: string | null;
  format: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  ownerType: string | null;
  ownerId: string | null;
  isUsed: boolean;
  uploadedById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SiteSettingsValue = {
  hospitalName: string | null;
  logo: string | null;
  favicon: string | null;
  hotline: string | null;
  emergencyHotline: string | null;
  email: string | null;
  address: string | null;
  workingHours: string | null;
  mapUrl: string | null;
  socialLinks: Record<string, string>;
};

export type SiteSettingsRecord = {
  id: string;
  key: string;
  value: SiteSettingsValue;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  image: string;
  mobileImage: string | null;
  linkUrl: string | null;
  target: string | null;
  position: string;
  order: number;
  isActive: boolean;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicFAQ = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
