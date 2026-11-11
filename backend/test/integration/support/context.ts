import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { getCookie, startHttpServer } from "../../support/http.js";
import {
  buildVnpayCallbackQuery,
  buildVnpayQueryResponse,
  buildVnpayRefundResponse,
} from "../../support/vnpay.js";
export { assert, after, before, beforeEach, test, bcrypt, jwt, getCookie, startHttpServer, buildVnpayCallbackQuery, buildVnpayQueryResponse, buildVnpayRefundResponse };


if (process.env.NODE_ENV !== "test") {
  throw new Error("Integration tests require NODE_ENV=test.");
}

// Integration verifies that Prisma query events are attributed to the active
// HTTP request without exposing SQL or parameters.
process.env.DATABASE_QUERY_METRICS_ENABLED = "true";

export const activeDatabaseUrl = process.env.DATABASE_URL || "";
export const activeDatabase = new URL(activeDatabaseUrl);
export const activeDatabaseMarker =
  `${activeDatabase.pathname} ${activeDatabase.searchParams.get("schema") || ""}`.toLowerCase();
export const activeDatabaseSchema =
  activeDatabase.searchParams.get("schema")?.trim() || "public";

if (!activeDatabaseMarker.includes("test")) {
  throw new Error(
    "Refusing to run destructive integration tests outside a test database/schema.",
  );
}

if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(activeDatabaseSchema)) {
  throw new Error("Integration test schema name is invalid.");
}

export const [
  { createApp },
  { prisma },
  { generateDashboardAccessToken, generatePatientAccessToken },
  { default: AuthOtpService },
  { default: AppointmentService },
  { default: ScheduleReconciliationService },
  { default: AuthSessionService },
  { default: NotificationService },
  { default: MedicalRecordService },
  { default: PrescriptionService },
  { default: InvoiceService },
  { default: RbacService },
  { default: PolicyService },
  { isFirebaseAdminConfigured },
] = await Promise.all([
  import("../../../src/app.js"),
  import("../../../src/config/prisma.js"),
  import("../../../src/utils/jwt.js"),
  import("../../../src/services/authOtp.service.js"),
  import("../../../src/services/appointment.service.js"),
  import("../../../src/services/scheduleReconciliation.service.js"),
  import("../../../src/services/authSession.service.js"),
  import("../../../src/services/notification.service.js"),
  import("../../../src/services/medicalRecord.service.js"),
  import("../../../src/services/prescription.service.js"),
  import("../../../src/services/invoice.service.js"),
  import("../../../src/services/rbac.service.js"),
  import("../../../src/services/policy.service.js"),
  import("../../../src/config/firebaseAdmin.js"),
]);

export type Fixture = Awaited<ReturnType<typeof seedFixture>>;

export let fixture: Fixture;
export let http: Awaited<ReturnType<typeof startHttpServer>>;

export const futureDate = (daysFromNow: number) => {
  const date = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
};

export const dateOnly = (value: string) => new Date(`${value}T00:00:00.000Z`);

export const resetDatabase = async () => {
  const targetTables = [
    "DashboardLoginFailure",
    "OtpSecurityBlock",
    "OtpVerifyAttempt",
    "StockMovement",
    "StockBatch",
    "AuditLog",
    "Medicine",
    "User",
    "Department",
  ]
    .map((table) => `"${activeDatabaseSchema}"."${table}"`)
    .join(", ");
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${targetTables} RESTART IDENTITY CASCADE`,
  );
};

export async function seedFixture() {
  const password = "phase0-password";
  const passwordHash = await bcrypt.hash(password, 4);
  const department = await prisma.department.create({
    data: {
      name: "Phase 0 Test Department",
      slug: "phase-0-test-department",
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      fullName: "Phase 0 Admin",
      phone: "0900000003",
      password: passwordHash,
      role: "ADMIN",
      isPhoneVerified: true,
    },
  });

  const doctorOneWithUser = await prisma.doctorProfile.create({
    data: {
      slug: "doctor-one",
      user: {
        create: {
          fullName: "Doctor One",
          phone: "0900000001",
          password: passwordHash,
          role: "DOCTOR",
          isPhoneVerified: true,
        },
      },
      department: { connect: { id: department.id } },
      consultationFee: 300000,
    },
    include: { user: true },
  });
  const doctorTwoWithUser = await prisma.doctorProfile.create({
    data: {
      slug: "doctor-two",
      user: {
        create: {
          fullName: "Doctor Two",
          phone: "0900000002",
          password: passwordHash,
          role: "DOCTOR",
          isPhoneVerified: true,
        },
      },
      department: { connect: { id: department.id } },
      consultationFee: 350000,
    },
    include: { user: true },
  });
  const { user: doctorOneUser, ...doctorOne } = doctorOneWithUser;
  const { user: doctorTwoUser, ...doctorTwo } = doctorTwoWithUser;

  const appointmentDate = futureDate(7);
  const slotOne = await prisma.doctorTimeSlot.create({
    data: {
      doctorId: doctorOne.id,
      date: dateOnly(appointmentDate),
      startTime: "09:00",
      endTime: "09:30",
    },
  });
  const slotTwo = await prisma.doctorTimeSlot.create({
    data: {
      doctorId: doctorOne.id,
      date: dateOnly(appointmentDate),
      startTime: "10:00",
      endTime: "10:30",
    },
  });

  return {
    password,
    department,
    doctorOne,
    doctorTwo,
    doctorOneUser,
    doctorTwoUser,
    adminUser,
    appointmentDate,
    slotOne,
    slotTwo,
  };
}

export const bookingBody = (input: {
  phone: string;
  timeSlotId?: string;
  doctorId?: string;
}) => ({
  departmentId: fixture.department.id,
  doctorId: input.doctorId || fixture.doctorOne.id,
  timeSlotId: input.timeSlotId || fixture.slotOne.id,
  patientName: "Phase Zero Patient",
  patientPhone: input.phone,
  otpChannel: "SMS",
  reason: "Baseline integration test",
});

export const createStoredAppointment = async (input: {
  status:
    | "PENDING_OTP"
    | "PENDING_CONFIRM"
    | "CONFIRMED"
    | "CHECKED_IN"
    | "COMPLETED";
  phone?: string;
  bookingCode?: string;
  timeSlotId?: string;
}) => {
  const phone = input.phone || "0911111111";
  const bookingCode = input.bookingCode || "PHASE0-BASELINE";
  const patient = await prisma.user.create({
    data: {
      fullName: "Stored Patient",
      phone,
      role: "PATIENT",
      isPhoneVerified: true,
    },
  });

  const timeSlot = input.timeSlotId
    ? await prisma.doctorTimeSlot.findUniqueOrThrow({
        where: { id: input.timeSlotId },
      })
    : fixture.slotTwo;
  await prisma.doctorTimeSlot.update({
    where: { id: timeSlot.id },
    data: { status: "BOOKED" },
  });

  return prisma.appointment.create({
    data: {
      bookingCode,
      appointmentDate: dateOnly(fixture.appointmentDate),
      startTime: timeSlot.startTime,
      endTime: timeSlot.endTime,
      status: input.status,
      patientName: patient.fullName,
      patientPhone: phone,
      patientId: patient.id,
      doctorId: fixture.doctorOne.id,
      departmentId: fixture.department.id,
      timeSlotId: timeSlot.id,
      estimatedPrice: 300000,
      finalAmount: 300000,
    },
  });
};

export const authCookie = async (
  userId: string,
  role: "ADMIN" | "DOCTOR" | "STAFF" | "PHARMACIST",
) => {
  const authSession = await AuthSessionService.create({
    userId,
    kind: "DASHBOARD",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  const token = generateDashboardAccessToken(
    { userId, role, sessionId: authSession.session.id },
    "15m",
  );
  return `dashboard_token=${token}`;
};

export const dashboardHeaders = (cookie: string) => ({
  cookie,
  "x-hospital-dashboard-request": "1",
});

export const loginPatient = async (phone: string) => {
  const requested = await http.request("/api/v1/auth/patient/request-otp", {
    method: "POST",
    body: { phone },
  });
  assert.equal(requested.status, 200);
  assert.equal(typeof requested.body.data.debugOtp, "string");

  const verified = await http.request("/api/v1/auth/patient/verify-otp", {
    method: "POST",
    body: {
      challengeId: requested.body.data.challengeId,
      otp: requested.body.data.debugOtp,
      deviceId: `device-${phone}`,
      deviceName: "Integration test device",
      platform: "android",
      appVersion: "1.0.0",
    },
  });
  assert.equal(verified.status, 200);
  assert.equal(verified.body.data.tokenType, "Bearer");
  return verified.body.data as {
    accessToken: string;
    refreshToken: string;
    user: { id: string };
  };
};

before(async () => {
  http = await startHttpServer(
    createApp({
      requestLogging: false,
      slowRequestLogging: true,
      performanceHeaders: true,
      queryMetricsEnabled: true,
      slowRequestThresholdMs: 60_000,
    }),
  );
});

beforeEach(async () => {
  await resetDatabase();
  fixture = await seedFixture();
});

after(async () => {
  await http.close();
  await prisma.$disconnect();
});

export const emailBookingBody = (input: {
  phone: string;
  email: string;
  timeSlotId?: string;
}) => ({
  ...bookingBody({ phone: input.phone, timeSlotId: input.timeSlotId }),
  otpChannel: "EMAIL",
  patientEmail: input.email,
});

export const createPayableInvoice = async (input: {
  bookingCode: string;
  phone?: string;
  timeSlotId?: string;
  amount?: number;
}) => {
  const amount = input.amount ?? 300000;
  const appointment = await createStoredAppointment({
    status: "COMPLETED",
    bookingCode: input.bookingCode,
    phone: input.phone,
    timeSlotId: input.timeSlotId,
  });
  const invoice = await prisma.invoice.create({
    data: {
      invoiceCode: `INV-${input.bookingCode}`,
      barcode: `BAR-${input.bookingCode}`,
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      totalAmount: amount,
      finalAmount: amount,
    },
  });
  const authorization = `Bearer ${(await loginPatient(appointment.patientPhone)).accessToken}`;
  return { appointment, invoice, authorization };
};

export const createVnpayPayment = async (
  invoiceId: string,
  authorization: string,
  idempotencyKey: string,
) => {
  const response = await http.request(`/api/v1/me/invoices/${invoiceId}/payments`, {
    method: "POST",
    headers: { authorization, "idempotency-key": idempotencyKey },
    body: { provider: "VNPAY" },
  });
  assert.equal(response.status, 201);
  return response.body.data as { id: string; transactionCode: string; paymentUrl: string };
};

export const vnpayIpn = (query: string) => http.request(`/api/v1/payments/vnpay/ipn?${query}`);

export const createDashboardUser = async (role: "STAFF" | "PHARMACIST", phone: string) =>
  prisma.user.create({
    data: {
      fullName: `RBAC ${role}`,
      phone,
      role,
      isPhoneVerified: true,
    },
  });

export const vietnamClock = (offsetMs: number) => {
  const shifted = new Date(Date.now() + offsetMs + 7 * 60 * 60 * 1000).toISOString();
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) };
};

export const moveAppointmentStart = async (appointmentId: string, offsetMs: number) => {
  const { date, time } = vietnamClock(offsetMs);
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { appointmentDate: dateOnly(date), startTime: time },
  });
};

export const createMedicineViaApi = async (
  cookie: string,
  input: { code: string; name: string; unit?: string; minStock?: number; unitPrice?: number },
) => {
  const response = await http.request("/api/v1/dashboard/pharmacy/medicines", {
    method: "POST",
    headers: dashboardHeaders(cookie),
    body: { unit: "viên", ...input },
  });
  assert.equal(response.status, 201);
  return response.body.data as { id: string; code: string; stockQuantity: number };
};

export const receiveViaApi = async (cookie: string, medicineId: string, quantity: number) => {
  const response = await http.request(`/api/v1/dashboard/pharmacy/medicines/${medicineId}/receipts`, {
    method: "POST",
    headers: dashboardHeaders(cookie),
    body: { quantity, reason: "Nhập theo phiếu" },
  });
  assert.equal(response.status, 201);
  return response.body.data as { stockQuantity: number };
};

export const createIssuedPrescription = async (input: {
  code: string;
  phone: string;
  timeSlotId: string;
  items: { medicineName: string; quantity: number | null; medicineId?: string }[];
}) => {
  const appointment = await createStoredAppointment({
    status: "COMPLETED",
    bookingCode: `BK-${input.code}`,
    phone: input.phone,
    timeSlotId: input.timeSlotId,
  });
  const record = await prisma.medicalRecord.create({
    data: {
      recordCode: `REC-${input.code}`,
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      status: "DRAFT",
    },
  });
  const prescription = await prisma.prescription.create({
    data: {
      prescriptionCode: input.code,
      medicalRecordId: record.id,
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      status: "ISSUED",
      issuedAt: new Date(),
      items: {
        create: input.items.map((item, index) => ({
          medicineName: item.medicineName,
          quantity: item.quantity,
          medicineId: item.medicineId,
          unit: "viên",
          sortOrder: index,
        })),
      },
    },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  return { appointment, prescription };
};

// ---- Đối soát VNPAY bằng querydr -----------------------------------------
export const withStubbedVnpayQuery = async (
  responder: (txnRef: string) => unknown,
  run: () => Promise<void>,
) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { vnp_TxnRef: string; vnp_Command: string };
    assert.equal(body.vnp_Command, "querydr");
    return new Response(JSON.stringify(responder(body.vnp_TxnRef)), { status: 200 });
  }) as typeof fetch;
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
};

// ---- Hoàn tiền VNPAY qua API ----------------------------------------------
export const withStubbedVnpayRefund = async (
  responder: (body: Record<string, unknown>) => unknown,
  run: () => Promise<void>,
) => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
    // Chỉ chặn lời gọi tới VNPAY; các lời gọi HTTP của chính test vẫn đi qua fetch thật.
    if (!String(url).includes("merchant_webapi")) return originalFetch(url, init);
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    assert.equal(body.vnp_Command, "refund");
    return new Response(JSON.stringify(responder(body)), { status: 200 });
  }) as typeof fetch;
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
};

export const createVnpayPaidInvoice = async (bookingCode: string) => {
  const created = await createPayableInvoice({ bookingCode });
  const payment = await createVnpayPayment(
    created.invoice.id,
    created.authorization,
    `idem-${bookingCode}`,
  );
  const ipn = await vnpayIpn(
    buildVnpayCallbackQuery({ transactionCode: payment.transactionCode, amount: 300000 }),
  );
  assert.equal(ipn.body.RspCode, "00");
  return { ...created, payment };
};

export const callVnpayRefund = (invoiceId: string, cookie: string, refundReason = "Benh nhan huy dich vu") =>
  http.request(`/api/v1/dashboard/invoices/${invoiceId}/refund/vnpay`, {
    method: "POST",
    headers: dashboardHeaders(cookie),
    body: { refundReason },
  });

// ---- Nhật ký truy cập, buộc đổi mật khẩu, tách quyền nhạy cảm -----------------
export const dashboardCall = (
  method: string,
  path: string,
  cookie: string,
  body?: unknown,
) => http.request(path, { method, headers: dashboardHeaders(cookie), body });

// ---- Nhập CSV kho thuốc ------------------------------------------------------------------
export const isoDateFromToday = (days: number) =>
  new Date(Date.now() + 7 * 3_600_000 + days * 86_400_000).toISOString().slice(0, 10);
