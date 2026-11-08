export type PatientUser = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  avatar: string | null;
  isPhoneVerified: boolean;
  patientProfile?: {
    dateOfBirth?: string | null;
    gender?: "MALE" | "FEMALE" | "OTHER" | null;
    cccd?: string | null;
    address?: string | null;
    hasBHYT?: boolean;
    healthInsuranceCode?: string | null;
    registeredHospital?: string | null;
    bloodType?: string | null;
    height?: number | null;
    weight?: number | null;
    allergies?: string | null;
    medicalHistory?: string | null;
    familyHistory?: string | null;
    bloodPressure?: string | null;
    healthConsentVersion?: string | null;
  } | null;
};

export type PatientAppointment = {
  id: string;
  bookingCode: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: string;
  patientName: string;
  recipientType?: "SELF" | "DEPENDENT";
  reason?: string | null;
  estimatedPrice?: number;
  serviceFee?: number;
  hasBHYT?: boolean;
  bhytDiscount?: number;
  finalAmount: number;
  confirmedAt?: string | null;
  cancelledAt?: string | null;
  cancelledReason?: string | null;
  completedAt?: string | null;
  doctor: {
    title: string | null;
    specialization: string | null;
    user: { fullName: string; avatar: string | null };
  };
  department: { name: string; slug: string | null };
  package: { name: string; slug: string | null } | null;
};

export type PatientMedicalRecord = {
  id: string;
  recordCode: string;
  diagnosis: string | null;
  symptoms?: string | null;
  treatment?: string | null;
  prescription?: string | null;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  appointment: { bookingCode: string; patientName: string };
  doctor: { title: string | null; specialization?: string | null; user: { fullName: string }; department?: { name: string; slug?: string | null } };
  resultFile?: { available: boolean; downloadUrl: string | null };
  labResults: Array<{ id: string; testName: string; resultValue?: string | null; unit?: string | null; referenceRange?: string | null; conclusion: string | null; file?: { available: boolean; downloadUrl: string | null } }>;
};

export type PatientPrescription = {
  id: string;
  prescriptionCode: string;
  issuedAt: string | null;
  note?: string | null;
  createdAt: string;
  doctor: { title: string | null; user: { fullName: string } };
  items: Array<{ id: string; medicineName: string; dosage: string; frequency: string; duration?: string | null; quantity?: number | null; unit?: string | null; instruction?: string | null }>;
};

export type PatientInvoice = {
  id: string;
  invoiceCode: string;
  finalAmount: number;
  totalAmount?: number;
  bhytDiscount?: number;
  insuranceDiscountAmount?: number;
  status: string;
  paymentMethod?: string | null;
  paidAt?: string | null;
  createdAt: string;
  appointment: { bookingCode: string; patientName?: string; appointmentDate?: string; startTime?: string; endTime?: string; department: { name: string }; doctor?: { title: string | null; user: { fullName: string } }; package?: { name: string } | null };
  items?: Array<{ id: string; description: string; quantity: number; unitPrice: number; amount: number }>;
};

export type PatientDependent = {
  id: string;
  fullName: string;
  relationship: string;
  dateOfBirth: string | null;
  hasBHYT: boolean;
  phone?: string | null;
  email?: string | null;
  gender?: "MALE" | "FEMALE" | "OTHER" | null;
  cccd?: string | null;
  address?: string | null;
  healthInsuranceCode?: string | null;
  registeredHospital?: string | null;
  allergies?: string | null;
  medicalHistory?: string | null;
  familyHistory?: string | null;
};

export type PatientSession = {
  id: string;
  deviceName: string | null;
  platform: string | null;
  userAgent: string | null;
  ipAddress?: string | null;
  appVersion?: string | null;
  createdAt?: string;
  expiresAt?: string;
  lastUsedAt: string;
  isCurrent: boolean;
};

export type PatientNotificationType =
  | "SYSTEM_ANNOUNCEMENT"
  | "APPOINTMENT_CONFIRMED"
  | "APPOINTMENT_RESCHEDULED"
  | "APPOINTMENT_CANCELLED"
  | "APPOINTMENT_REMINDER"
  | "APPOINTMENT_NO_SHOW"
  | "APPOINTMENT_CHECKED_IN"
  | "APPOINTMENT_IN_PROGRESS"
  | "APPOINTMENT_COMPLETED"
  | "MEDICAL_RESULT_PUBLISHED"
  | "PRESCRIPTION_ISSUED"
  | "PRESCRIPTION_DISPENSED"
  | "INVOICE_CREATED"
  | "PAYMENT_SUCCEEDED"
  | "PAYMENT_REFUNDED"
  | string;

export type PatientNotification = {
  id: string;
  type: PatientNotificationType;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  publishedAt: string;
  createdAt: string;
  readAt: string | null;
  isRead: boolean;
};

type Collection<T> = {
  items: T[];
  total: number;
};

export type PatientPortalOverview = {
  profile: PatientUser;
  appointments: Collection<PatientAppointment>;
  medicalRecords: Collection<PatientMedicalRecord>;
  prescriptions: Collection<PatientPrescription>;
  invoices: Collection<PatientInvoice>;
  dependents: PatientDependent[];
  sessions: PatientSession[];
};

