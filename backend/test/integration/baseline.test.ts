import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { getCookie, startHttpServer } from "../support/http.js";
import {
  buildVnpayCallbackQuery,
  buildVnpayQueryResponse,
  buildVnpayRefundResponse,
} from "../support/vnpay.js";

if (process.env.NODE_ENV !== "test") {
  throw new Error("Integration tests require NODE_ENV=test.");
}

// Integration verifies that Prisma query events are attributed to the active
// HTTP request without exposing SQL or parameters.
process.env.DATABASE_QUERY_METRICS_ENABLED = "true";

const activeDatabaseUrl = process.env.DATABASE_URL || "";
const activeDatabase = new URL(activeDatabaseUrl);
const activeDatabaseMarker =
  `${activeDatabase.pathname} ${activeDatabase.searchParams.get("schema") || ""}`.toLowerCase();
const activeDatabaseSchema =
  activeDatabase.searchParams.get("schema")?.trim() || "public";

if (!activeDatabaseMarker.includes("test")) {
  throw new Error(
    "Refusing to run destructive integration tests outside a test database/schema.",
  );
}

if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(activeDatabaseSchema)) {
  throw new Error("Integration test schema name is invalid.");
}

const [
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
  import("../../src/app.js"),
  import("../../src/config/prisma.js"),
  import("../../src/utils/jwt.js"),
  import("../../src/services/authOtp.service.js"),
  import("../../src/services/appointment.service.js"),
  import("../../src/services/scheduleReconciliation.service.js"),
  import("../../src/services/authSession.service.js"),
  import("../../src/services/notification.service.js"),
  import("../../src/services/medicalRecord.service.js"),
  import("../../src/services/prescription.service.js"),
  import("../../src/services/invoice.service.js"),
  import("../../src/services/rbac.service.js"),
  import("../../src/services/policy.service.js"),
  import("../../src/config/firebaseAdmin.js"),
]);

type Fixture = Awaited<ReturnType<typeof seedFixture>>;

let fixture: Fixture;
let http: Awaited<ReturnType<typeof startHttpServer>>;

const futureDate = (daysFromNow: number) => {
  const date = new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
};

const dateOnly = (value: string) => new Date(`${value}T00:00:00.000Z`);

const resetDatabase = async () => {
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

async function seedFixture() {
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

const bookingBody = (input: {
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

const createStoredAppointment = async (input: {
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

const authCookie = async (
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

const dashboardHeaders = (cookie: string) => ({
  cookie,
  "x-hospital-dashboard-request": "1",
});

const loginPatient = async (phone: string) => {
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

test("v1 public content aliases preserve the legacy response contracts", async () => {
  const endpoints = [
    "banners",
    "departments",
    "doctors",
    "packages",
    "faqs",
    "site-settings",
    "chatbot/settings",
  ];

  for (const endpoint of endpoints) {
    const legacyResponse = await http.request(`/api/${endpoint}`);
    const v1Response = await http.request(`/api/v1/${endpoint}`);

    assert.equal(legacyResponse.status, 200, `legacy ${endpoint}`);
    assert.equal(v1Response.status, 200, `v1 ${endpoint}`);
    assert.deepEqual(v1Response.body, legacyResponse.body, endpoint);
    assert.match(
      legacyResponse.headers.get("server-timing") || "",
      /^app;dur=\d+(?:\.\d+)?, db;dur=\d+(?:\.\d+)?$/,
    );
    if (endpoint === "departments") {
      assert.ok(
        Number(legacyResponse.headers.get("x-database-query-count")) > 0,
        "department request should report at least one database query",
      );
    }
  }
});

test("public catalogs paginate and filter without changing legacy arrays", async () => {
  // Gói công khai phải có ít nhất một hạng mục đã bao gồm (publicCompletePackageWhere).
  const includedItem = { create: [{ name: "Khám lâm sàng", included: true }] };
  await prisma.package.create({
    data: {
      name: "Gói tim mạch phổ biến",
      slug: "goi-tim-mach-pho-bien",
      departmentId: fixture.department.id,
      basePrice: 1200000,
      isPopular: true,
      isBHYTSupport: true,
      items: includedItem,
    },
  });
  await prisma.package.create({
    data: {
      name: "Gói kiểm tra cơ bản",
      slug: "goi-kiem-tra-co-ban",
      departmentId: fixture.department.id,
      basePrice: 600000,
      items: includedItem,
    },
  });

  const doctors = await http.request(
    `/api/v1/doctors/catalog?departmentId=${fixture.department.id}&page=1&limit=1`,
  );
  assert.equal(doctors.status, 200);
  assert.equal(doctors.body.data.items.length, 1);
  assert.equal(doctors.body.data.pagination.total, 2);
  assert.equal(doctors.body.data.pagination.totalPages, 2);
  assert.equal(typeof doctors.body.data.items[0].reviewSummary.count, "number");

  const packages = await http.request(
    "/api/v1/packages/catalog?isPopular=true&isBHYTSupport=true&page=1&limit=10",
  );
  assert.equal(packages.status, 200);
  assert.equal(packages.body.data.items.length, 1);
  assert.equal(packages.body.data.items[0].slug, "goi-tim-mach-pho-bien");
  assert.equal(packages.body.data.pagination.total, 1);

  const legacyDoctors = await http.request("/api/v1/doctors?limit=1");
  const legacyPackages = await http.request("/api/v1/packages?limit=1");
  assert.ok(Array.isArray(legacyDoctors.body.data));
  assert.ok(Array.isArray(legacyPackages.body.data));
  assert.equal(legacyDoctors.body.data.length, 1);
  assert.equal(legacyPackages.body.data.length, 1);
});

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

test("one slot can be booked only once", async () => {
  const first = await http.request("/api/appointments", {
    method: "POST",
    body: bookingBody({ phone: "0912345678" }),
  });
  const second = await http.request("/api/appointments", {
    method: "POST",
    body: bookingBody({ phone: "0912345679" }),
  });

  assert.equal(first.status, 201);
  assert.equal(first.body.success, true);
  assert.equal(second.status, 409);
  assert.equal(second.body.success, false);

  const appointments = await prisma.appointment.count({
    where: { timeSlotId: fixture.slotOne.id },
  });
  assert.equal(appointments, 1);
});

test("booking OTP verification moves PENDING_OTP to PENDING_CONFIRM", async () => {
  const booking = await http.request("/api/v1/appointments", {
    method: "POST",
    body: bookingBody({ phone: "0912345678" }),
  });

  const verification = await http.request(
    `/api/v1/appointments/${booking.body.data.appointmentId}/verify-otp`,
    {
      method: "POST",
      body: { otp: booking.body.data.debugOtp },
    },
  );

  assert.equal(verification.status, 200);
  assert.equal(verification.body.success, true);
  assert.equal(verification.body.data.status, "PENDING_CONFIRM");
});

test("a signed hold grant releases only its pending slot", async () => {
  const booking = await http.request("/api/v1/appointments", {
    method: "POST",
    body: bookingBody({ phone: "0912345680" }),
  });
  assert.equal(booking.status, 201);
  assert.equal(typeof booking.body.data.holdReleaseToken, "string");

  const rejected = await http.request(
    `/api/v1/appointments/${booking.body.data.appointmentId}/pending`,
    {
      method: "DELETE",
      body: { holdReleaseToken: "x".repeat(40) },
    },
  );
  assert.equal(rejected.status, 401);

  const released = await http.request(
    `/api/v1/appointments/${booking.body.data.appointmentId}/pending`,
    {
      method: "DELETE",
      body: { holdReleaseToken: booking.body.data.holdReleaseToken },
    },
  );
  assert.equal(released.status, 200);
  assert.equal(released.body.data.released, true);
  assert.equal(released.body.data.alreadyReleased, false);

  const stored = await prisma.appointment.findUniqueOrThrow({
    where: { id: booking.body.data.appointmentId },
    select: { status: true, timeSlotId: true },
  });
  assert.equal(stored.status, "CANCELLED_BY_PATIENT");
  assert.equal(stored.timeSlotId, null);
  assert.equal(
    (await prisma.doctorTimeSlot.findUniqueOrThrow({
      where: { id: fixture.slotOne.id },
      select: { status: true },
    })).status,
    "AVAILABLE",
  );

  const repeated = await http.request(
    `/api/v1/appointments/${booking.body.data.appointmentId}/pending`,
    {
      method: "DELETE",
      body: { holdReleaseToken: booking.body.data.holdReleaseToken },
    },
  );
  assert.equal(repeated.status, 200);
  assert.equal(repeated.body.data.alreadyReleased, true);
});

test("unverified booking input does not mutate an existing patient", async () => {
  const existingPatient = await prisma.user.create({
    data: {
      fullName: "Verified Patient",
      phone: "0955555555",
      email: "verified-patient@example.com",
      role: "PATIENT",
      isPhoneVerified: true,
      patientProfile: {
        create: {
          address: "Verified address",
          medicalHistory: "Verified history",
        },
      },
    },
  });

  const booking = await http.request("/api/appointments", {
    method: "POST",
    body: {
      ...bookingBody({ phone: existingPatient.phone! }),
      patientName: "Unverified New Name",
      patientEmail: "new-patient-email@example.com",
      address: "Unverified address",
      medicalHistory: "Unverified history",
      healthConsent: true,
    },
  });
  assert.equal(booking.status, 201);

  const beforeVerification = await prisma.user.findUniqueOrThrow({
    where: { id: existingPatient.id },
    include: { patientProfile: true },
  });
  assert.equal(beforeVerification.fullName, "Verified Patient");
  assert.equal(beforeVerification.email, "verified-patient@example.com");
  assert.equal(beforeVerification.patientProfile?.address, "Verified address");

  const pendingSnapshot = await prisma.appointment.findUniqueOrThrow({
    where: { id: booking.body.data.appointmentId },
  });
  assert.equal(pendingSnapshot.patientName, "Unverified New Name");
  assert.equal(pendingSnapshot.patientEmail, "new-patient-email@example.com");
  assert.equal(pendingSnapshot.patientAddress, "Unverified address");

  const verification = await http.request(
    `/api/appointments/${pendingSnapshot.id}/verify-otp`,
    { method: "POST", body: { otp: booking.body.data.debugOtp } },
  );
  assert.equal(verification.status, 200);

  const afterVerification = await prisma.user.findUniqueOrThrow({
    where: { id: existingPatient.id },
    include: { patientProfile: true },
  });
  assert.equal(afterVerification.fullName, "Unverified New Name");
  assert.equal(afterVerification.email, "new-patient-email@example.com");
  assert.equal(afterVerification.patientProfile?.address, "Unverified address");
  assert.equal(
    afterVerification.patientProfile?.medicalHistory,
    "Unverified history",
  );
});

test("verified booking preserves profile fields omitted by the client", async () => {
  const existingPatient = await prisma.user.create({
    data: {
      fullName: "Existing Patient",
      phone: "0955555556",
      email: "keep-email@example.com",
      role: "PATIENT",
      isPhoneVerified: true,
      patientProfile: {
        create: {
          gender: "FEMALE",
          dateOfBirth: new Date("1995-05-20T00:00:00.000Z"),
          address: "Keep this address",
          cccd: "012345678902",
          hasBHYT: true,
          healthInsuranceCode: "DN4012345678902",
          registeredHospital: "Keep this hospital",
          allergies: "Penicillin",
          medicalHistory: "Existing history",
          familyHistory: "Existing family history",
        },
      },
    },
  });

  const booking = await http.request("/api/appointments", {
    method: "POST",
    body: bookingBody({ phone: existingPatient.phone! }),
  });
  assert.equal(booking.status, 201);

  const verification = await http.request(
    `/api/appointments/${booking.body.data.appointmentId}/verify-otp`,
    { method: "POST", body: { otp: booking.body.data.debugOtp } },
  );
  assert.equal(verification.status, 200);

  const stored = await prisma.user.findUniqueOrThrow({
    where: { id: existingPatient.id },
    include: { patientProfile: true },
  });
  assert.equal(stored.email, "keep-email@example.com");
  assert.equal(stored.patientProfile?.gender, "FEMALE");
  assert.equal(
    stored.patientProfile?.dateOfBirth?.toISOString(),
    "1995-05-20T00:00:00.000Z",
  );
  assert.equal(stored.patientProfile?.address, "Keep this address");
  assert.equal(stored.patientProfile?.cccd, "012345678902");
  assert.equal(stored.patientProfile?.hasBHYT, true);
  assert.equal(
    stored.patientProfile?.healthInsuranceCode,
    "DN4012345678902",
  );
  assert.equal(
    stored.patientProfile?.registeredHospital,
    "Keep this hospital",
  );
  assert.equal(stored.patientProfile?.allergies, "Penicillin");
  assert.equal(stored.patientProfile?.medicalHistory, "Existing history");
  assert.equal(
    stored.patientProfile?.familyHistory,
    "Existing family history",
  );
});

test("canonical ownership conflicts do not transition the appointment", async () => {
  await prisma.user.create({
    data: {
      fullName: "Canonical Owner",
      phone: "0966666666",
      email: "owned@example.com",
      role: "PATIENT",
      isPhoneVerified: true,
      patientProfile: { create: { cccd: "012345678901" } },
    },
  });

  const booking = await http.request("/api/appointments", {
    method: "POST",
    body: {
      ...bookingBody({ phone: "0977777777" }),
      patientEmail: "owned@example.com",
      cccd: "012345678901",
    },
  });
  assert.equal(booking.status, 201);

  const verification = await http.request(
    `/api/appointments/${booking.body.data.appointmentId}/verify-otp`,
    { method: "POST", body: { otp: booking.body.data.debugOtp } },
  );
  assert.equal(verification.status, 409);

  const pending = await prisma.appointment.findUniqueOrThrow({
    where: { id: booking.body.data.appointmentId },
    select: { status: true },
  });
  assert.equal(pending.status, "PENDING_OTP");
});

const emailBookingBody = (input: {
  phone: string;
  email: string;
  timeSlotId?: string;
}) => ({
  ...bookingBody({ phone: input.phone, timeSlotId: input.timeSlotId }),
  otpChannel: "EMAIL",
  patientEmail: input.email,
});

test("an email OTP cannot attach a booking to a phone account owned by another email", async () => {
  const victim = await prisma.user.create({
    data: {
      fullName: "Victim Patient",
      phone: "0944444441",
      email: "victim-owner@example.com",
      role: "PATIENT",
      isPhoneVerified: true,
      isEmailVerified: true,
      patientProfile: { create: { address: "Victim address" } },
    },
  });

  const attempt = await http.request("/api/appointments", {
    method: "POST",
    body: {
      ...emailBookingBody({
        phone: victim.phone!,
        email: "attacker@example.com",
      }),
      patientName: "Attacker Name",
      address: "Attacker address",
    },
  });
  assert.equal(attempt.status, 409);
  assert.equal(attempt.body.code, "ACCOUNT_LOGIN_REQUIRED");

  assert.equal(
    await prisma.appointment.count({ where: { patientPhone: victim.phone! } }),
    0,
  );
  assert.equal(
    (await prisma.doctorTimeSlot.findUniqueOrThrow({
      where: { id: fixture.slotOne.id },
      select: { status: true },
    })).status,
    "AVAILABLE",
  );

  const stored = await prisma.user.findUniqueOrThrow({
    where: { id: victim.id },
    include: { patientProfile: true },
  });
  assert.equal(stored.email, "victim-owner@example.com");
  assert.equal(stored.fullName, "Victim Patient");
  assert.equal(stored.patientProfile?.address, "Victim address");
});

test("a phone-verified account without an email cannot be claimed by an email OTP", async () => {
  const account = await prisma.user.create({
    data: {
      fullName: "Phone Only Patient",
      phone: "0944444442",
      role: "PATIENT",
      isPhoneVerified: true,
    },
  });

  const attempt = await http.request("/api/appointments", {
    method: "POST",
    body: emailBookingBody({
      phone: account.phone!,
      email: "claimer@example.com",
    }),
  });
  assert.equal(attempt.status, 409);
  assert.equal(attempt.body.code, "ACCOUNT_LOGIN_REQUIRED");

  const stored = await prisma.user.findUniqueOrThrow({
    where: { id: account.id },
  });
  assert.equal(stored.email, null);
});

test("the owner of the registered email can still book as a guest", async () => {
  const owner = await prisma.user.create({
    data: {
      fullName: "Registered Owner",
      phone: "0944444443",
      email: "registered-owner@example.com",
      role: "PATIENT",
      isPhoneVerified: true,
    },
  });

  const booking = await http.request("/api/appointments", {
    method: "POST",
    body: emailBookingBody({
      phone: owner.phone!,
      email: "Registered-Owner@Example.com",
    }),
  });
  assert.equal(booking.status, 201);
  assert.equal(typeof booking.body.data.debugOtp, "string");

  const verification = await http.request(
    `/api/appointments/${booking.body.data.appointmentId}/verify-otp`,
    { method: "POST", body: { otp: booking.body.data.debugOtp } },
  );
  assert.equal(verification.status, 200);
  assert.equal(verification.body.data.status, "PENDING_CONFIRM");

  const appointment = await prisma.appointment.findUniqueOrThrow({
    where: { id: booking.body.data.appointmentId },
    select: { patientId: true },
  });
  assert.equal(appointment.patientId, owner.id);
});

test("a brand new phone is claimed by the first verified email and marks it verified", async () => {
  const booking = await http.request("/api/appointments", {
    method: "POST",
    body: emailBookingBody({
      phone: "0944444444",
      email: "first-claim@example.com",
    }),
  });
  assert.equal(booking.status, 201);

  const verification = await http.request(
    `/api/appointments/${booking.body.data.appointmentId}/verify-otp`,
    { method: "POST", body: { otp: booking.body.data.debugOtp } },
  );
  assert.equal(verification.status, 200);

  const claimed = await prisma.user.findUniqueOrThrow({
    where: { phone: "0944444444" },
  });
  assert.equal(claimed.email, "first-claim@example.com");
  assert.equal(claimed.isEmailVerified, true);
});

test("an account claimed between booking and verification blocks the second claimer", async () => {
  // Two guests book the same unverified phone with different emails.
  const first = await http.request("/api/appointments", {
    method: "POST",
    body: emailBookingBody({
      phone: "0944444445",
      email: "claim-one@example.com",
      timeSlotId: fixture.slotOne.id,
    }),
  });
  const second = await http.request("/api/appointments", {
    method: "POST",
    body: emailBookingBody({
      phone: "0944444445",
      email: "claim-two@example.com",
      timeSlotId: fixture.slotTwo.id,
    }),
  });
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);

  const firstVerified = await http.request(
    `/api/appointments/${first.body.data.appointmentId}/verify-otp`,
    { method: "POST", body: { otp: first.body.data.debugOtp } },
  );
  assert.equal(firstVerified.status, 200);

  const secondVerified = await http.request(
    `/api/appointments/${second.body.data.appointmentId}/verify-otp`,
    { method: "POST", body: { otp: second.body.data.debugOtp } },
  );
  assert.equal(secondVerified.status, 409);
  assert.equal(secondVerified.body.code, "ACCOUNT_LOGIN_REQUIRED");

  const owner = await prisma.user.findUniqueOrThrow({
    where: { phone: "0944444445" },
  });
  assert.equal(owner.email, "claim-one@example.com");
  assert.equal(
    (await prisma.appointment.findUniqueOrThrow({
      where: { id: second.body.data.appointmentId },
      select: { status: true },
    })).status,
    "PENDING_OTP",
  );
});

test("public booking is rate limited per phone with a Retry-After header", async () => {
  // The limiter is off in the test environment so the suite can call the API in
  // bulk; this test turns it on for its own requests only.
  process.env.RATE_LIMIT_ENABLED = "true";
  try {
    const responses = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      responses.push(
        await http.request("/api/appointments", {
          method: "POST",
          body: bookingBody({ phone: "0933333333" }),
        }),
      );
    }

    assert.ok(responses.slice(0, 5).every((item) => item.status !== 429));

    const limited = responses[5];
    assert.equal(limited.status, 429);
    assert.equal(limited.body.code, "RATE_LIMITED");
    assert.ok(Number(limited.headers.get("retry-after")) > 0);
  } finally {
    delete process.env.RATE_LIMIT_ENABLED;
  }
});

test("pharmacy schema enforces non-negative stock and consistent ledger rows", async () => {
  const pharmacist = await prisma.user.create({
    data: {
      fullName: "Phase Pharmacist",
      phone: "0900000009",
      role: "PHARMACIST",
      isPhoneVerified: true,
    },
  });
  const medicine = await prisma.medicine.create({
    data: { code: "PARA500", name: "Paracetamol 500mg", unit: "viên", stockQuantity: 10 },
  });
  const movement = (data: Record<string, unknown>) =>
    prisma.stockMovement.create({
      data: {
        medicineId: medicine.id,
        actorId: pharmacist.id,
        type: "RECEIPT",
        quantity: 5,
        balanceAfter: 15,
        ...data,
      } as never,
    });

  // Stock can never go negative, even through a direct write.
  await assert.rejects(
    prisma.medicine.update({ where: { id: medicine.id }, data: { stockQuantity: -1 } }),
    /Medicine_stockQuantity_nonnegative|check constraint/i,
  );
  // Medicine codes are unique.
  await assert.rejects(
    prisma.medicine.create({ data: { code: "PARA500", name: "Duplicate", unit: "viên" } }),
    /Unique constraint|PARA500|code/i,
  );

  // Ledger rows must match their type.
  await assert.rejects(movement({ quantity: 0 }), /quantity_nonzero|check constraint/i);
  await assert.rejects(movement({ type: "RECEIPT", quantity: -5 }), /sign_matches_type|check constraint/i);
  await assert.rejects(
    movement({ type: "DISPENSE", quantity: -3, balanceAfter: 7, prescriptionItemId: null }),
    /dispense_has_item|check constraint/i,
  );
  await assert.rejects(
    movement({ type: "ADJUSTMENT", quantity: -2, balanceAfter: 8, reason: "   " }),
    /adjustment_has_reason|check constraint/i,
  );

  const receipt = await movement({});
  assert.equal(receipt.quantity, 5);

  // The ledger is append-only.
  await assert.rejects(
    prisma.stockMovement.update({ where: { id: receipt.id }, data: { reason: "edited" } }),
    /append-only|chỉ thêm dòng/i,
  );
  await assert.rejects(
    prisma.stockMovement.delete({ where: { id: receipt.id } }),
    /append-only|chỉ thêm dòng/i,
  );

  // Referenced medicines and actors cannot be deleted.
  await assert.rejects(prisma.medicine.delete({ where: { id: medicine.id } }));
  await assert.rejects(prisma.user.delete({ where: { id: pharmacist.id } }));
});

test("new log actions and prescription dispense defaults are available", async () => {
  const appointment = await createStoredAppointment({ status: "COMPLETED" });

  for (const action of [
    "MEDICAL_RESULT_UPDATED",
    "MEDICAL_RESULT_PUBLISHED",
    "LAB_RESULT_CHANGED",
    "PRESCRIPTION_ISSUED",
    "PRESCRIPTION_CANCELLED",
    "PRESCRIPTION_DISPENSED",
  ] as const) {
    await prisma.appointmentLog.create({
      data: { appointmentId: appointment.id, action, note: "schema check" },
    });
  }
  assert.equal(
    await prisma.appointmentLog.count({ where: { appointmentId: appointment.id } }),
    6,
  );

  const record = await prisma.medicalRecord.create({
    data: {
      recordCode: "REC-SCHEMA-1",
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      doctorId: fixture.doctorOne.id,
    },
  });
  const prescription = await prisma.prescription.create({
    data: {
      prescriptionCode: "RX-SCHEMA-1",
      medicalRecordId: record.id,
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      doctorId: fixture.doctorOne.id,
      items: { create: [{ medicineName: "Thuốc mua ngoài", quantity: 2 }] },
    },
    include: { items: true },
  });

  assert.equal(prescription.dispenseStatus, "NOT_DISPENSED");
  assert.equal(prescription.dispensedAt, null);
  assert.equal(prescription.items[0].medicineId, null);
  assert.equal(prescription.items[0].dispensedQuantity, 0);
});

test("health consent columns are optional on appointments", async () => {
  const appointment = await createStoredAppointment({ status: "PENDING_CONFIRM" });
  const stored = await prisma.appointment.findUniqueOrThrow({
    where: { id: appointment.id },
    select: { healthConsentAt: true, healthConsentVersion: true },
  });
  assert.equal(stored.healthConsentAt, null);
  assert.equal(stored.healthConsentVersion, null);

  const consentAt = new Date();
  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { healthConsentAt: consentAt, healthConsentVersion: "v1" },
    select: { healthConsentAt: true, healthConsentVersion: true },
  });
  assert.equal(updated.healthConsentVersion, "v1");
  assert.equal(updated.healthConsentAt?.toISOString(), consentAt.toISOString());
});

test("pending OTP expiry is idempotent and releases only its own slot", async () => {
  const appointment = await createStoredAppointment({
    status: "PENDING_OTP",
    bookingCode: "PHASE0-EXPIRY",
  });
  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { holdExpiresAt: new Date(Date.now() - 60_000) },
  });
  await prisma.doctorTimeSlot.update({
    where: { id: fixture.slotOne.id },
    data: { status: "LOCKED", lockReason: "Must remain locked" },
  });

  const results = await Promise.all([
    AppointmentService.expirePendingOtpAppointment(appointment.id),
    AppointmentService.expirePendingOtpAppointment(appointment.id),
  ]);
  assert.deepEqual(
    results.map((result) => result.outcome).sort(),
    ["EXPIRED", "NOOP"],
  );

  const stored = await prisma.appointment.findUniqueOrThrow({
    where: { id: appointment.id },
    select: { status: true, timeSlotId: true },
  });
  assert.equal(stored.status, "CANCELLED_BY_ADMIN");
  assert.equal(stored.timeSlotId, null);
  assert.equal(
    (
      await prisma.doctorTimeSlot.findUniqueOrThrow({
        where: { id: fixture.slotTwo.id },
      })
    ).status,
    "AVAILABLE",
  );
  const unrelatedSlot = await prisma.doctorTimeSlot.findUniqueOrThrow({
    where: { id: fixture.slotOne.id },
  });
  assert.equal(unrelatedSlot.status, "LOCKED");
  assert.equal(
    await prisma.appointmentLog.count({
      where: { appointmentId: appointment.id, action: "CANCELLED_BY_ADMIN" },
    }),
    1,
  );

  const rebooked = await http.request("/api/appointments", {
    method: "POST",
    body: bookingBody({
      phone: "0959595959",
      timeSlotId: fixture.slotTwo.id,
    }),
  });
  assert.equal(rebooked.status, 201);
});

test("expiry after OTP verification is a no-op and reconciliation catches legacy holds", async () => {
  const verified = await createStoredAppointment({
    status: "PENDING_CONFIRM",
    bookingCode: "PHASE0-EXPIRY-NOOP",
  });
  const noOp = await AppointmentService.expirePendingOtpAppointment(
    verified.id,
    { now: new Date(Date.now() + 60 * 60 * 1000) },
  );
  assert.equal(noOp.outcome, "NOOP");

  await prisma.appointment.update({
    where: { id: verified.id },
    data: {
      status: "PENDING_OTP",
      holdExpiresAt: null,
      createdAt: new Date(Date.now() - 20 * 60 * 1000),
    },
  });
  const reconciliation = await AppointmentService.reconcileExpiredPendingOtp({
    fallbackExpireMinutes: 10,
  });
  assert.equal(reconciliation.scanned, 1);
  assert.equal(reconciliation.expired, 1);
});

test("reconciliation cancels a pending confirmation after its visit window", async () => {
  const appointment = await createStoredAppointment({
    status: "PENDING_CONFIRM",
    bookingCode: "PHASE0-PENDING-CONFIRM-OVERDUE",
  });
  await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      appointmentDate: dateOnly("2026-01-10"),
      startTime: "09:00",
      endTime: "09:30",
    },
  });

  const result = await AppointmentService.reconcilePastPendingConfirmations({
    now: new Date("2026-01-10T03:00:00.000Z"), // 10:00 in Viet Nam.
  });
  assert.equal(result.expired, 1);

  const stored = await prisma.appointment.findUniqueOrThrow({
    where: { id: appointment.id },
    select: {
      status: true,
      cancelledReason: true,
      timeSlotId: true,
    },
  });
  assert.equal(stored.status, "CANCELLED_BY_ADMIN");
  assert.equal(
    stored.cancelledReason,
    "Lịch chờ bệnh viện xác nhận đã quá giờ khám",
  );
  assert.equal(stored.timeSlotId, null);
  assert.equal(
    await prisma.notification.count({
      where: {
        userId: appointment.patientId,
        entityId: appointment.id,
        type: "APPOINTMENT_CANCELLED",
      },
    }),
    1,
  );
});

test("pending confirmation remains active before its visit window ends", async () => {
  const appointment = await createStoredAppointment({
    status: "PENDING_CONFIRM",
    bookingCode: "PHASE0-PENDING-CONFIRM-ACTIVE",
  });
  await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      appointmentDate: dateOnly("2026-01-10"),
      startTime: "09:00",
      endTime: "09:30",
    },
  });

  const result = await AppointmentService.expirePastPendingConfirmation(
    appointment.id,
    { now: new Date("2026-01-10T02:15:00.000Z") }, // 09:15 in Viet Nam.
  );
  assert.equal(result.outcome, "NOOP");
  assert.equal(
    (
      await prisma.appointment.findUniqueOrThrow({
        where: { id: appointment.id },
        select: { status: true },
      })
    ).status,
    "PENDING_CONFIRM",
  );
});

test("OTP verification and expiry race leaves one valid final state", async () => {
  const booking = await http.request("/api/appointments", {
    method: "POST",
    body: bookingBody({ phone: "0988888888" }),
  });
  assert.equal(booking.status, 201);
  const appointmentId = booking.body.data.appointmentId as string;

  const [verification, expiry] = await Promise.all([
    http.request(`/api/appointments/${appointmentId}/verify-otp`, {
      method: "POST",
      body: { otp: booking.body.data.debugOtp },
    }),
    AppointmentService.expirePendingOtpAppointment(appointmentId, {
      now: new Date(Date.now() + 60 * 60 * 1000),
    }),
  ]);

  const stored = await prisma.appointment.findUniqueOrThrow({
    where: { id: appointmentId },
    select: { status: true, timeSlotId: true },
  });
  assert.ok(
    stored.status === "PENDING_CONFIRM" ||
      stored.status === "CANCELLED_BY_ADMIN",
  );

  if (stored.status === "PENDING_CONFIRM") {
    assert.equal(verification.status, 200);
    assert.equal(expiry.outcome, "NOOP");
    assert.equal(stored.timeSlotId, fixture.slotOne.id);
  } else {
    assert.equal(verification.status, 409);
    assert.equal(expiry.outcome, "EXPIRED");
    assert.equal(stored.timeSlotId, null);
  }
  assert.equal(
    (
      await prisma.doctorTimeSlot.findUniqueOrThrow({
        where: { id: fixture.slotOne.id },
      })
    ).status,
    stored.status === "PENDING_CONFIRM" ? "BOOKED" : "AVAILABLE",
  );
});

test("a doctor cannot read or transition another doctor's appointment", async () => {
  const appointment = await createStoredAppointment({ status: "CHECKED_IN" });
  const cookie = await authCookie(fixture.doctorTwoUser.id, "DOCTOR");

  const read = await http.request(
    `/api/dashboard/appointments/${appointment.id}`,
    { headers: dashboardHeaders(cookie) },
  );
  const transition = await http.request(
    `/api/dashboard/appointments/${appointment.id}/start`,
    { method: "PATCH", headers: dashboardHeaders(cookie) },
  );

  assert.equal(read.status, 404);
  assert.equal(transition.status, 404);
  const unchanged = await prisma.appointment.findUniqueOrThrow({
    where: { id: appointment.id },
  });
  assert.equal(unchanged.status, "CHECKED_IN");
});

test("competing transitions produce exactly one committed state", async () => {
  const appointment = await createStoredAppointment({
    status: "CHECKED_IN",
    bookingCode: "PHASE0-TRANSITION-RACE",
  });
  const doctorCookie = await authCookie(fixture.doctorOneUser.id, "DOCTOR");
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");
  const endpoint = `/api/dashboard/appointments/${appointment.id}`;

  const [start, noShow] = await Promise.all([
    http.request(`${endpoint}/start`, {
      method: "PATCH",
      headers: dashboardHeaders(doctorCookie),
    }),
    http.request(`${endpoint}/no-show`, {
      method: "PATCH",
      headers: dashboardHeaders(adminCookie),
    }),
  ]);

  const responses = [start, noShow].sort((left, right) =>
    left.status - right.status,
  );
  assert.equal(responses[0].status, 200);
  assert.equal(responses[1].status, 409);
  assert.equal(responses[1].body.code, "APPOINTMENT_STATE_CONFLICT");

  const stored = await prisma.appointment.findUniqueOrThrow({
    where: { id: appointment.id },
    select: {
      status: true,
      timeSlotId: true,
      logs: {
        where: { action: { in: ["IN_PROGRESS", "NO_SHOW"] } },
        select: { action: true },
      },
    },
  });
  assert.ok(stored.status === "IN_PROGRESS" || stored.status === "NO_SHOW");
  assert.equal(
    stored.timeSlotId,
    stored.status === "IN_PROGRESS" ? fixture.slotTwo.id : null,
  );
  assert.equal(
    (
      await prisma.doctorTimeSlot.findUniqueOrThrow({
        where: { id: fixture.slotTwo.id },
      })
    ).status,
    stored.status === "IN_PROGRESS" ? "BOOKED" : "AVAILABLE",
  );
  assert.equal(stored.logs.length, 1);
  assert.equal(stored.logs[0].action, stored.status);
  assert.equal(
    await prisma.medicalRecord.count({
      where: { appointmentId: appointment.id },
    }),
    stored.status === "IN_PROGRESS" ? 1 : 0,
  );
});

test("starting the same appointment twice creates one medical record and log", async () => {
  const appointment = await createStoredAppointment({
    status: "CHECKED_IN",
    bookingCode: "PHASE0-START-RACE",
  });
  const cookie = await authCookie(fixture.doctorOneUser.id, "DOCTOR");
  const endpoint = `/api/dashboard/appointments/${appointment.id}/start`;

  const responses = await Promise.all([
    http.request(endpoint, { method: "PATCH", headers: dashboardHeaders(cookie) }),
    http.request(endpoint, { method: "PATCH", headers: dashboardHeaders(cookie) }),
  ]);
  responses.sort((left, right) => left.status - right.status);

  assert.equal(responses[0].status, 200);
  assert.equal(responses[1].status, 409);
  assert.equal(responses[1].body.code, "APPOINTMENT_STATE_CONFLICT");

  const stored = await prisma.appointment.findUniqueOrThrow({
    where: { id: appointment.id },
    select: { status: true },
  });
  assert.equal(stored.status, "IN_PROGRESS");
  assert.equal(
    await prisma.medicalRecord.count({
      where: { appointmentId: appointment.id },
    }),
    1,
  );
  assert.equal(
    await prisma.appointmentLog.count({
      where: { appointmentId: appointment.id, action: "IN_PROGRESS" },
    }),
    1,
  );
});

test("dashboard cookie login, refresh and logout remain compatible", async () => {
  const login = await http.request("/api/auth/dashboard/login", {
    method: "POST",
    body: {
      phone: fixture.adminUser.phone,
      password: fixture.password,
    },
  });
  assert.equal(login.status, 200);
  assert.equal(login.body.success, true);
  // Phản hồi đăng nhập không được lộ email hay số điện thoại đầy đủ, chỉ bản đã che.
  const loginText = JSON.stringify(login.body.data);
  if (fixture.adminUser.phone) assert.ok(!loginText.includes(fixture.adminUser.phone));
  if (fixture.adminUser.email) assert.ok(!loginText.includes(fixture.adminUser.email));
  assert.match(String(login.body.data.otpTarget), /\*/);

  const verification = await http.request("/api/auth/dashboard/verify-otp", {
    method: "POST",
    body: {
      challengeId: login.body.data.challengeId,
      otp: login.body.data.debugOtp,
    },
  });
  assert.equal(verification.status, 200);
  assert.match(verification.headers.get("set-cookie") || "", /HttpOnly/i);

  const firstRefreshToken = getCookie(
    verification.headers,
    "dashboard_refresh_token",
  );
  assert.ok(firstRefreshToken);

  const csrfRejected = await http.request("/api/auth/dashboard/refresh", {
    method: "POST",
    headers: {
      cookie: `dashboard_refresh_token=${firstRefreshToken}`,
    },
  });
  assert.equal(csrfRejected.status, 403);
  assert.equal(csrfRejected.body.code, "CSRF_VALIDATION_FAILED");

  const refresh = await http.request("/api/auth/dashboard/refresh", {
    method: "POST",
    headers: {
      cookie: `dashboard_refresh_token=${firstRefreshToken}`,
      "x-hospital-dashboard-request": "1",
    },
  });
  assert.equal(refresh.status, 200);
  const rotatedRefreshToken = getCookie(
    refresh.headers,
    "dashboard_refresh_token",
  );
  assert.ok(rotatedRefreshToken);
  assert.notEqual(rotatedRefreshToken, firstRefreshToken);

  const logout = await http.request("/api/auth/dashboard/logout", {
    method: "POST",
    headers: {
      cookie: `dashboard_refresh_token=${rotatedRefreshToken}`,
      "x-hospital-dashboard-request": "1",
    },
  });
  assert.equal(logout.status, 200);
  assert.equal(logout.body.success, true);

  const refreshAfterLogout = await http.request(
    "/api/auth/dashboard/refresh",
    {
      method: "POST",
      headers: {
        cookie: `dashboard_refresh_token=${rotatedRefreshToken}`,
        "x-hospital-dashboard-request": "1",
      },
    },
  );
  assert.equal(refreshAfterLogout.status, 401);
});

test("dashboard rejects legacy access tokens without strict claims and an active session", async () => {
  const legacyToken = jwt.sign(
    { userId: fixture.adminUser.id, role: "ADMIN" },
    process.env.JWT_SECRET!,
    { expiresIn: "15m" },
  );

  const response = await http.request("/api/dashboard/appointments", {
    headers: { cookie: `dashboard_token=${legacyToken}` },
  });

  assert.equal(response.status, 401);
  assert.equal(response.body.message, "Token không hợp lệ");
});

test("dashboard login limits repeated password failures by account and IP", async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const rejected = await http.request("/api/auth/dashboard/login", {
      method: "POST",
      body: {
        phone: fixture.adminUser.phone,
        password: "incorrect-password",
      },
    });
    assert.equal(rejected.status, 401);
  }

  const limited = await http.request("/api/auth/dashboard/login", {
    method: "POST",
    body: {
      phone: fixture.adminUser.phone,
      password: fixture.password,
    },
  });

  assert.equal(limited.status, 429);
  assert.equal(limited.body.code, "LOGIN_RATE_LIMITED");
});

test("invoice creation is rejected until the appointment is COMPLETED", async () => {
  const appointment = await createStoredAppointment({ status: "CONFIRMED" });
  const cookie = await authCookie(fixture.adminUser.id, "ADMIN");
  const endpoint = `/api/dashboard/invoices/appointments/${appointment.id}`;

  const rejected = await http.request(endpoint, {
    method: "POST",
    headers: dashboardHeaders(cookie),
    body: {},
  });
  assert.equal(rejected.status, 400);
  assert.equal(rejected.body.success, false);

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  const created = await http.request(endpoint, {
    method: "POST",
    headers: dashboardHeaders(cookie),
    body: {},
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.success, true);
  assert.equal(typeof created.body.data.id, "string");

  const storedInvoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: created.body.data.id },
    select: { appointmentId: true },
  });
  assert.equal(storedInvoice.appointmentId, appointment.id);

  const duplicate = await http.request(endpoint, {
    method: "POST",
    headers: dashboardHeaders(cookie),
    body: {},
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.code, "INVOICE_ALREADY_EXISTS");
});

test("concurrent invoice publication creates one invoice and one notification", async () => {
  const appointment = await createStoredAppointment({
    status: "COMPLETED",
    bookingCode: "PHASE0-INVOICE-RACE",
  });

  const results = await Promise.allSettled([
    InvoiceService.createForAppointment(appointment.id, {}),
    InvoiceService.createForAppointment(appointment.id, {}),
  ]);
  const fulfilled = results.filter(
    (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof InvoiceService.createForAppointment>>> =>
      result.status === "fulfilled",
  );
  const rejected = results.filter(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );

  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal((rejected[0].reason as { statusCode?: number }).statusCode, 409);
  assert.equal(
    (rejected[0].reason as { code?: string }).code,
    "INVOICE_ALREADY_EXISTS",
  );

  const [invoices, notificationCount, logCount] = await Promise.all([
    prisma.invoice.findMany({
      where: { appointmentId: appointment.id },
      include: { items: true },
    }),
    prisma.notification.count({
      where: {
        userId: appointment.patientId,
        type: "INVOICE_CREATED",
      },
    }),
    prisma.appointmentLog.count({
      where: {
        appointmentId: appointment.id,
        action: "INVOICE_CREATED",
      },
    }),
  ]);

  assert.equal(invoices.length, 1);
  assert.equal(notificationCount, 1);
  assert.equal(logCount, 1);
  assert.equal(
    invoices[0].items.reduce((sum, item) => sum + item.amount, 0),
    invoices[0].totalAmount,
  );
});

test("concurrent manual collection records one payment receipt", async () => {
  const appointment = await createStoredAppointment({
    status: "COMPLETED",
    bookingCode: "PHASE0-PAY-RACE",
  });
  const invoice = await InvoiceService.createForAppointment(appointment.id, {});

  const results = await Promise.allSettled([
    InvoiceService.pay(invoice.id, { paymentMethod: "CASH" }, fixture.adminUser.id),
    InvoiceService.pay(invoice.id, { paymentMethod: "CASH" }, fixture.adminUser.id),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  assert.equal((rejected?.reason as { statusCode?: number }).statusCode, 409);
  assert.equal((rejected?.reason as { code?: string }).code, "INVOICE_STATE_CONFLICT");

  const [stored, notificationCount, paymentLogCount] = await Promise.all([
    prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } }),
    prisma.notification.count({
      where: { userId: appointment.patientId, type: "PAYMENT_SUCCEEDED" },
    }),
    prisma.appointmentLog.count({
      where: { appointmentId: appointment.id, action: "PAYMENT_RECORDED" },
    }),
  ]);
  assert.equal(stored.status, "PAID");
  assert.equal(stored.paymentMethod, "CASH");
  assert.equal(notificationCount, 1);
  assert.equal(paymentLogCount, 1);
});

test("manual collection is blocked while an online payment is pending", async () => {
  const appointment = await createStoredAppointment({
    status: "COMPLETED",
    bookingCode: "PHASE0-PENDING-ONLINE",
  });
  const invoice = await InvoiceService.createForAppointment(appointment.id, {});
  await prisma.paymentTransaction.create({
    data: {
      invoiceId: invoice.id,
      provider: "VNPAY",
      amount: invoice.finalAmount,
      transactionCode: "PHASE0-PENDING-ONLINE",
      activeKey: `invoice:${invoice.id}`,
      expiredAt: new Date(Date.now() + 60_000),
    },
  });

  await assert.rejects(
    () => InvoiceService.pay(invoice.id, { paymentMethod: "CASH" }, fixture.adminUser.id),
    (error: unknown) => {
      assert.equal((error as { statusCode?: number }).statusCode, 409);
      assert.equal((error as { code?: string }).code, "ONLINE_PAYMENT_PENDING");
      return true;
    },
  );
  const stored = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
  assert.equal(stored.status, "UNPAID");
});

const createPayableInvoice = async (input: {
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

const createVnpayPayment = async (
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

const vnpayIpn = (query: string) => http.request(`/api/payments/vnpay/ipn?${query}`);

test("patient payment APIs enforce ownership, idempotency and the capability gate", async () => {
  const { invoice, authorization } = await createPayableInvoice({
    bookingCode: "PHASE0-PAYMENT",
  });

  const missingSession = await http.request(
    `/api/v1/me/invoices/${invoice.id}/payments`,
    { method: "POST", body: { provider: "VNPAY" } },
  );
  assert.equal(missingSession.status, 401);

  const capabilities = await http.request("/api/v1/me/payment-capabilities", {
    headers: { authorization },
  });
  assert.equal(capabilities.status, 200);
  assert.deepEqual(
    capabilities.body.data.providers.map((item: { provider: string }) => item.provider),
    ["VNPAY"],
  );
  assert.equal(capabilities.body.data.providers[0].isMock, undefined);

  // Providers that were removed are rejected by validation, not routed anywhere.
  for (const provider of ["MOCK", "MOMO"]) {
    const rejected = await http.request(`/api/v1/me/invoices/${invoice.id}/payments`, {
      method: "POST",
      headers: { authorization },
      body: { provider },
    });
    assert.equal(rejected.status, 400);
  }

  const createResponses = await Promise.all(
    Array.from({ length: 10 }, () =>
      http.request(`/api/v1/me/invoices/${invoice.id}/payments`, {
        method: "POST",
        headers: { authorization, "idempotency-key": "phase0-payment-create-retry" },
        body: { provider: "VNPAY" },
      }),
    ),
  );
  assert.ok(createResponses.every((response) => response.status === 201));
  const [created] = createResponses;
  assert.equal(created.body.data.provider, "VNPAY");
  assert.match(created.body.data.paymentUrl, /^https:\/\/sandbox\.vnpayment\.vn\//);
  assert.equal(new Set(createResponses.map((response) => response.body.data.id)).size, 1);
  assert.equal(
    await prisma.paymentTransaction.count({
      where: { invoiceId: invoice.id, status: "PENDING" },
    }),
    1,
  );

  const idempotentRetry = await http.request(`/api/v1/me/invoices/${invoice.id}/payments`, {
    method: "POST",
    headers: { authorization, "idempotency-key": "phase0-payment-create-retry" },
    body: { provider: "VNPAY" },
  });
  assert.equal(idempotentRetry.status, 201);
  assert.equal(idempotentRetry.body.data.id, created.body.data.id);

  await prisma.user.create({
    data: {
      fullName: "Payment Patient B",
      phone: "0944444444",
      role: "PATIENT",
      isPhoneVerified: true,
    },
  });
  const patientBAuthorization = `Bearer ${(await loginPatient("0944444444")).accessToken}`;
  const crossPatientRead = await http.request(`/api/v1/me/payments/${created.body.data.id}`, {
    headers: { authorization: patientBAuthorization },
  });
  assert.equal(crossPatientRead.status, 404);

  // The simulated-settlement endpoints and the generic webhook no longer exist.
  const removedMock = await http.request(
    `/api/v1/me/payments/mock/${created.body.data.transactionCode}/success`,
    { method: "POST", headers: { authorization } },
  );
  assert.equal(removedMock.status, 404);
  const removedWebhook = await http.request("/api/payments/momo/webhook", {
    method: "POST",
    body: {},
  });
  assert.equal(removedWebhook.status, 404);

  const dashboardInvoice = await http.request(`/api/dashboard/invoices/${invoice.id}`, {
    headers: dashboardHeaders(await authCookie(fixture.adminUser.id, "ADMIN")),
  });
  assert.equal(dashboardInvoice.status, 200);
  assert.equal(dashboardInvoice.body.data.paymentTransactions.length, 1);
  assert.equal(dashboardInvoice.body.data.paymentTransactions[0].rawResponse, undefined);

  const originalFlag = process.env.PAYMENT_VNPAY_ENABLED;
  process.env.PAYMENT_VNPAY_ENABLED = "false";
  try {
    const disabledCapabilities = await http.request("/api/v1/me/payment-capabilities", {
      headers: { authorization },
    });
    assert.deepEqual(disabledCapabilities.body.data.providers, []);

    const disabledCreate = await http.request(`/api/v1/me/invoices/${invoice.id}/payments`, {
      method: "POST",
      headers: { authorization },
      body: { provider: "VNPAY" },
    });
    assert.equal(disabledCreate.status, 404);
    assert.equal(disabledCreate.body.code, "PAYMENT_PROVIDER_UNAVAILABLE");
  } finally {
    process.env.PAYMENT_VNPAY_ENABLED = originalFlag;
  }
});

test("VNPay IPN rejects forged callbacks and settles a payment exactly once", async () => {
  const { appointment, invoice, authorization } = await createPayableInvoice({
    bookingCode: "VNPAY-SETTLE",
  });
  const payment = await createVnpayPayment(invoice.id, authorization, "vnpay-settle");
  const expectUnpaid = async () =>
    assert.equal(
      (await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status,
      "UNPAID",
    );

  // Tampered amount after signing, wrong secret, wrong merchant, unknown reference.
  const signed = buildVnpayCallbackQuery({ transactionCode: payment.transactionCode, amount: 300000 });
  assert.equal((await vnpayIpn(signed.replace("vnp_Amount=30000000", "vnp_Amount=100"))).body.RspCode, "97");
  assert.equal(
    (await vnpayIpn(buildVnpayCallbackQuery({ transactionCode: payment.transactionCode, amount: 300000, secret: "WRONGSECRETWRONGSECRETWRONGSEC12" }))).body.RspCode,
    "97",
  );
  assert.equal((await vnpayIpn("vnp_ResponseCode=00")).body.RspCode, "97");
  assert.equal(
    (await vnpayIpn(buildVnpayCallbackQuery({ transactionCode: payment.transactionCode, amount: 300000, tmnCode: "OTHERTMN" }))).body.RspCode,
    "99",
  );
  assert.equal(
    (await vnpayIpn(buildVnpayCallbackQuery({ transactionCode: "NO-SUCH-TXN", amount: 300000 }))).body.RspCode,
    "01",
  );
  // Correctly signed but for a different amount than the invoice.
  assert.equal(
    (await vnpayIpn(buildVnpayCallbackQuery({ transactionCode: payment.transactionCode, amount: 100000 }))).body.RspCode,
    "04",
  );
  await expectUnpaid();
  assert.equal(
    (await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: payment.id } })).status,
    "PENDING",
  );

  // Two identical valid IPNs in parallel, then a replay: one settlement only.
  const results = await Promise.all([vnpayIpn(signed), vnpayIpn(signed)]);
  assert.ok(results.every((response) => response.status === 200 && response.body.RspCode === "00"));
  assert.equal((await vnpayIpn(signed)).body.RspCode, "00");

  const paid = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
  assert.equal(paid.status, "PAID");
  assert.equal(paid.paymentMethod, "VNPAY");
  assert.equal(paid.paymentReference, "14000001");
  assert.equal(
    (await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: payment.id } })).status,
    "SUCCESS",
  );
  assert.equal(
    await prisma.appointmentLog.count({
      where: { appointmentId: appointment.id, action: "PAYMENT_RECORDED" },
    }),
    1,
  );
  assert.equal(
    await prisma.notification.count({
      where: { userId: appointment.patientId, type: "PAYMENT_SUCCEEDED" },
    }),
    1,
  );
});

test("VNPay return URL records the result and redirects to the web result page", async () => {
  const { invoice, authorization } = await createPayableInvoice({
    bookingCode: "VNPAY-RETURN",
  });
  const payment = await createVnpayPayment(invoice.id, authorization, "vnpay-return");

  const success = await http.request(
    `/api/payments/vnpay/return?${buildVnpayCallbackQuery({ transactionCode: payment.transactionCode, amount: 300000 })}`,
    { redirect: "manual" },
  );
  assert.equal(success.status, 302);
  const location = new URL(success.headers.get("location") || "");
  assert.equal(location.origin + location.pathname, "https://web.example.test/thanh-toan/ket-qua");
  assert.equal(location.searchParams.get("status"), "success");
  assert.equal(location.searchParams.get("orderId"), payment.transactionCode);
  assert.equal(
    (await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status,
    "PAID",
  );

  const forged = await http.request(
    `/api/payments/vnpay/return?${buildVnpayCallbackQuery({ transactionCode: payment.transactionCode, amount: 300000, secret: "WRONGSECRETWRONGSECRETWRONGSEC12" })}`,
    { redirect: "manual" },
  );
  assert.equal(forged.status, 302);
  assert.equal(new URL(forged.headers.get("location") || "").searchParams.get("status"), "error");
});

test("a failed VNPay payment frees the invoice and a late success is not applied", async () => {
  const { invoice, authorization } = await createPayableInvoice({
    bookingCode: "VNPAY-FAILED",
  });
  const first = await createVnpayPayment(invoice.id, authorization, "vnpay-failed-1");

  // Customer cancelled on the VNPay page (code 24): a valid callback, not a payment.
  const cancelled = await vnpayIpn(
    buildVnpayCallbackQuery({ transactionCode: first.transactionCode, amount: 300000, responseCode: "24" }),
  );
  assert.equal(cancelled.body.RspCode, "00");
  const failed = await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: first.id } });
  assert.equal(failed.status, "FAILED");
  assert.equal(failed.activeKey, null);
  assert.equal(
    (await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status,
    "UNPAID",
  );

  // A success that arrives for an already-failed transaction conflicts (code 02).
  const late = await vnpayIpn(
    buildVnpayCallbackQuery({ transactionCode: first.transactionCode, amount: 300000 }),
  );
  assert.equal(late.body.RspCode, "02");
  assert.equal(
    (await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status,
    "UNPAID",
  );

  // The patient can start a fresh payment afterwards.
  const second = await createVnpayPayment(invoice.id, authorization, "vnpay-failed-2");
  assert.notEqual(second.id, first.id);
});

test("an expired VNPay transaction becomes EXPIRED but a genuine late success still pays", async () => {
  const { invoice, authorization } = await createPayableInvoice({
    bookingCode: "VNPAY-EXPIRY",
  });
  const payment = await createVnpayPayment(invoice.id, authorization, "vnpay-expiry");
  await prisma.paymentTransaction.update({
    where: { id: payment.id },
    data: { expiredAt: new Date(Date.now() - 1000) },
  });

  const expired = await http.request(`/api/v1/me/payments/${payment.id}`, {
    headers: { authorization },
  });
  assert.equal(expired.status, 200);
  assert.equal(expired.body.data.status, "EXPIRED");
  assert.equal(
    (await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: payment.id } })).activeKey,
    null,
  );

  // The gateway can still confirm money that was actually taken after our timeout.
  const late = await vnpayIpn(
    buildVnpayCallbackQuery({ transactionCode: payment.transactionCode, amount: 300000 }),
  );
  assert.equal(late.body.RspCode, "00");
  assert.equal(
    (await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status,
    "PAID",
  );
});

const createDashboardUser = async (role: "STAFF" | "PHARMACIST", phone: string) =>
  prisma.user.create({
    data: {
      fullName: `RBAC ${role}`,
      phone,
      role,
      isPhoneVerified: true,
    },
  });

test("dynamic permissions keep clinical data away from admin editing and staff", async () => {
  const staff = await createDashboardUser("STAFF", "0900000011");
  const pharmacist = await createDashboardUser("PHARMACIST", "0900000012");
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");
  const staffCookie = await authCookie(staff.id, "STAFF");
  const pharmacistCookie = await authCookie(pharmacist.id, "PHARMACIST");
  const doctorCookie = await authCookie(fixture.doctorOneUser.id, "DOCTOR");
  const get = (path: string, cookie: string) =>
    http.request(path, { headers: dashboardHeaders(cookie) });
  const patch = (path: string, cookie: string, body: unknown = {}) =>
    http.request(path, { method: "PATCH", headers: dashboardHeaders(cookie), body });

  // Nhân viên không đọc bệnh án và đơn thuốc, nhưng vẫn làm việc tiếp đón.
  assert.equal((await get("/api/dashboard/medical-records", staffCookie)).status, 403);
  assert.equal((await get("/api/dashboard/prescriptions", staffCookie)).status, 403);
  assert.equal((await get("/api/dashboard/appointments", staffCookie)).status, 200);
  assert.equal((await get("/api/dashboard/invoices", staffCookie)).status, 200);

  // Quản trị mặc định không đọc nội dung y tế và không bao giờ sửa; chỉ bác sĩ ghi bệnh án và kê đơn.
  assert.equal((await get("/api/dashboard/medical-records", adminCookie)).status, 403);
  assert.equal((await get("/api/dashboard/prescriptions", adminCookie)).status, 403);
  assert.equal((await patch("/api/dashboard/prescriptions/any-id", adminCookie)).status, 403);
  assert.equal((await patch("/api/dashboard/medical-records/any-id", adminCookie)).status, 403);
  assert.equal((await get("/api/dashboard/medical-records", doctorCookie)).status, 200);

  // Dược sĩ đăng nhập dashboard được và đọc đơn thuốc, nhưng không đụng bệnh án, hóa đơn.
  assert.equal((await get("/api/dashboard/prescriptions", pharmacistCookie)).status, 200);
  assert.equal((await get("/api/dashboard/medical-records", pharmacistCookie)).status, 403);
  assert.equal((await get("/api/dashboard/invoices", pharmacistCookie)).status, 403);

  // Hoàn tiền chỉ quản trị.
  assert.equal((await patch("/api/dashboard/invoices/any-id/refund", staffCookie)).status, 403);

  // Chỉ quản trị đọc ma trận.
  assert.equal((await get("/api/dashboard/rbac", staffCookie)).status, 403);
  assert.equal((await get("/api/dashboard/rbac", doctorCookie)).status, 403);
  const matrix = await get("/api/dashboard/rbac", adminCookie);
  assert.equal(matrix.status, 200);
  const recordEdit = matrix.body.data.permissions.find(
    (item: { code: string }) => item.code === "record.edit",
  );
  assert.deepEqual(recordEdit.roles, ["DOCTOR"]);
  assert.deepEqual(recordEdit.eligibleRoles, ["DOCTOR"]);
});

test("the permission matrix is editable within eligibility and takes effect immediately", async () => {
  const staff = await createDashboardUser("STAFF", "0900000011");
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");
  const staffCookie = await authCookie(staff.id, "STAFF");
  const put = (grants: Record<string, string[]>) =>
    http.request("/api/dashboard/rbac", {
      method: "PUT",
      headers: dashboardHeaders(adminCookie),
      body: { grants },
    });
  const staffPay = () =>
    http.request("/api/dashboard/invoices/any-id/pay", {
      method: "PATCH",
      headers: dashboardHeaders(staffCookie),
      body: { paymentMethod: "CASH" },
    });

  try {
    // Cấp quyền ngoài tập đủ điều kiện bị từ chối, nêu rõ lý do.
    const notEligible = await put({ "record.edit": ["ADMIN"] });
    assert.equal(notEligible.status, 400);
    assert.equal(notEligible.body.code, "RBAC_ROLE_NOT_ELIGIBLE");
    const unknown = await put({ "made.up": ["ADMIN"] });
    assert.equal(unknown.status, 400);
    assert.equal(unknown.body.code, "RBAC_UNKNOWN_PERMISSION");

    // Gỡ quyền thu tiền của nhân viên: có hiệu lực ngay, không cần đăng nhập lại.
    assert.notEqual((await staffPay()).status, 403);
    assert.equal((await put({ "invoice.collect": ["ADMIN"] })).status, 200);
    assert.equal((await staffPay()).status, 403);

    // Quyền cố định không thể gỡ dù yêu cầu rỗng.
    assert.equal((await put({ "rbac.manage": [] })).status, 200);
    const stillManages = await http.request("/api/dashboard/rbac", {
      headers: dashboardHeaders(adminCookie),
    });
    assert.equal(stillManages.status, 200);

    // Khôi phục mặc định.
    const reset = await http.request("/api/dashboard/rbac", {
      method: "DELETE",
      headers: dashboardHeaders(adminCookie),
    });
    assert.equal(reset.status, 200);
    assert.notEqual((await staffPay()).status, 403);
  } finally {
    await RbacService.resetMatrix();
  }
});

test("staff without record.view see appointments without health history", async () => {
  const staff = await createDashboardUser("STAFF", "0900000011");
  const appointment = await createStoredAppointment({
    status: "CONFIRMED",
    bookingCode: "RBAC-MASK",
  });
  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { allergies: "Penicillin", medicalHistory: "Hen suyen", familyHistory: "Tim mach" },
  });
  const read = async (cookie: string) =>
    (
      await http.request(`/api/dashboard/appointments/${appointment.id}`, {
        headers: dashboardHeaders(cookie),
      })
    ).body.data;

  const asStaff = await read(await authCookie(staff.id, "STAFF"));
  assert.equal(asStaff.patientName, "Stored Patient");
  assert.equal(asStaff.allergies, null);
  assert.equal(asStaff.medicalHistory, null);
  assert.equal(asStaff.familyHistory, null);

  const asDoctor = await read(await authCookie(fixture.doctorOneUser.id, "DOCTOR"));
  assert.equal(asDoctor.allergies, "Penicillin");
  assert.equal(asDoctor.medicalHistory, "Hen suyen");
});

const vietnamClock = (offsetMs: number) => {
  const shifted = new Date(Date.now() + offsetMs + 7 * 60 * 60 * 1000).toISOString();
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) };
};

const moveAppointmentStart = async (appointmentId: string, offsetMs: number) => {
  const { date, time } = vietnamClock(offsetMs);
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { appointmentDate: dateOnly(date), startTime: time },
  });
};

test("health data in a booking requires explicit consent and records which version", async () => {
  const withoutConsent = await http.request("/api/appointments", {
    method: "POST",
    body: { ...bookingBody({ phone: "0955000001" }), allergies: "Penicillin" },
  });
  assert.equal(withoutConsent.status, 400);
  assert.equal(withoutConsent.body.code, "HEALTH_CONSENT_REQUIRED");
  assert.equal(await prisma.appointment.count({ where: { patientPhone: "0955000001" } }), 0);

  const withConsent = await http.request("/api/appointments", {
    method: "POST",
    body: {
      ...bookingBody({ phone: "0955000002" }),
      allergies: "Penicillin",
      healthConsent: true,
    },
  });
  assert.equal(withConsent.status, 201);
  const stored = await prisma.appointment.findUniqueOrThrow({
    where: { id: withConsent.body.data.appointmentId },
    select: { healthConsentAt: true, healthConsentVersion: true, allergies: true },
  });
  assert.ok(stored.healthConsentAt);
  assert.equal(stored.healthConsentVersion, "2026-11");
  assert.equal(stored.allergies, "Penicillin");

  // Không khai báo sức khỏe thì không cần và không ghi đồng ý.
  const plain = await http.request("/api/appointments", {
    method: "POST",
    body: bookingBody({ phone: "0955000003", timeSlotId: fixture.slotTwo.id }),
  });
  assert.equal(plain.status, 201);
  const plainStored = await prisma.appointment.findUniqueOrThrow({
    where: { id: plain.body.data.appointmentId },
    select: { healthConsentAt: true },
  });
  assert.equal(plainStored.healthConsentAt, null);
});

test("policy parameters are bounded, admin-only to change and drive patient cancellation", async () => {
  const staff = await createDashboardUser("STAFF", "0900000011");
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");
  const staffCookie = await authCookie(staff.id, "STAFF");
  const call = (method: string, cookie: string, body?: unknown) =>
    http.request("/api/dashboard/policy", { method, headers: dashboardHeaders(cookie), body });

  try {
    const defaults = await call("GET", staffCookie);
    assert.equal(defaults.status, 200);
    assert.equal(defaults.body.data.policy.patientCancelCutoffHours, 2);
    assert.equal(defaults.body.data.policy.noShowGraceMinutes, 0);

    assert.equal((await call("PUT", staffCookie, { noShowGraceMinutes: 30 })).status, 403);
    const outOfRange = await call("PUT", adminCookie, { patientCancelCutoffHours: 500 });
    assert.equal(outOfRange.status, 400);
    assert.equal(outOfRange.body.code, "POLICY_OUT_OF_RANGE");
    assert.equal((await call("PUT", adminCookie, { bookingHoldMinutes: 0 })).status, 400);

    // Lịch bắt đầu sau 1 giờ nằm trong hạn chót 2 giờ: người khám không tự hủy được.
    const soon = await createStoredAppointment({ status: "CONFIRMED", bookingCode: "POLICY-SOON" });
    await moveAppointmentStart(soon.id, 60 * 60 * 1000);
    await assert.rejects(
      () => AppointmentService.cancelByPatient(soon.id, soon.patientId, "Bận việc"),
      (error: { statusCode?: number; code?: string }) =>
        error.statusCode === 409 && error.code === "PATIENT_CANCEL_CUTOFF",
    );
    assert.equal(
      (await prisma.appointment.findUniqueOrThrow({ where: { id: soon.id } })).status,
      "CONFIRMED",
    );

    // Hạ hạn chót về 0 thì hủy được.
    assert.equal((await call("PUT", adminCookie, { patientCancelCutoffHours: 0 })).status, 200);
    await AppointmentService.cancelByPatient(soon.id, soon.patientId, "Bận việc");
    assert.equal(
      (await prisma.appointment.findUniqueOrThrow({ where: { id: soon.id } })).status,
      "CANCELLED_BY_PATIENT",
    );

    // Khôi phục mặc định.
    const reset = await call("DELETE", adminCookie);
    assert.equal(reset.status, 200);
    assert.equal(reset.body.data.policy.patientCancelCutoffHours, 2);
  } finally {
    await PolicyService.reset();
  }
});

test("auto no-show is off by default and honours the grace period when enabled", async () => {
  const late = await createStoredAppointment({ status: "CONFIRMED", bookingCode: "NOSHOW-LATE" });
  await moveAppointmentStart(late.id, -45 * 60 * 1000);
  const inGrace = await createStoredAppointment({
    status: "CONFIRMED",
    bookingCode: "NOSHOW-GRACE",
    phone: "0922222222",
    timeSlotId: fixture.slotOne.id,
  });
  await moveAppointmentStart(inGrace.id, -10 * 60 * 1000);
  const thirdSlot = await prisma.doctorTimeSlot.create({
    data: {
      doctorId: fixture.doctorOne.id,
      date: dateOnly(fixture.appointmentDate),
      startTime: "11:00",
      endTime: "11:30",
    },
  });
  const checkedIn = await createStoredAppointment({
    status: "CHECKED_IN",
    bookingCode: "NOSHOW-CHECKEDIN",
    phone: "0933333333",
    timeSlotId: thirdSlot.id,
  });
  await moveAppointmentStart(checkedIn.id, -45 * 60 * 1000);

  try {
    // Mặc định (0) là tắt: không lịch nào bị đụng tới.
    assert.deepEqual(await AppointmentService.reconcileNoShows(), { scanned: 0, marked: 0, noop: 0 });

    await PolicyService.update({ noShowGraceMinutes: 30 });
    const result = await AppointmentService.reconcileNoShows();
    assert.equal(result.marked, 1);

    const status = async (id: string) =>
      (await prisma.appointment.findUniqueOrThrow({ where: { id } })).status;
    assert.equal(await status(late.id), "NO_SHOW");
    assert.equal(await status(inGrace.id), "CONFIRMED");
    assert.equal(await status(checkedIn.id), "CHECKED_IN");

    const log = await prisma.appointmentLog.findFirstOrThrow({
      where: { appointmentId: late.id, action: "NO_SHOW" },
    });
    assert.equal(log.createdById, null);
    assert.match(log.note || "", /Tự động/);

    // Chạy lại không đánh dấu thêm.
    assert.equal((await AppointmentService.reconcileNoShows()).marked, 0);
  } finally {
    await PolicyService.reset();
  }
});

test("expired OTP codes are removed after a day while recent and live codes are kept", async () => {
  const hours = (value: number) => new Date(Date.now() + value * 60 * 60 * 1000);
  const create = (code: string, expiresAt: Date) =>
    prisma.otpCode.create({
      data: { phone: "0966000001", code, purpose: "BOOK_APPOINTMENT", expiresAt },
    });
  await create("old-1", hours(-72));
  await create("old-2", hours(-30));
  await create("recent", hours(-1));
  await create("live", hours(1));

  assert.deepEqual(await AuthOtpService.cleanupExpired(), { deleted: 2 });
  const remaining = await prisma.otpCode.findMany({
    where: { phone: "0966000001" },
    select: { code: true },
  });
  assert.deepEqual(remaining.map((item) => item.code).sort(), ["live", "recent"]);
  assert.deepEqual(await AuthOtpService.cleanupExpired(), { deleted: 0 });
});

const createMedicineViaApi = async (
  cookie: string,
  input: { code: string; name: string; unit?: string; minStock?: number; unitPrice?: number },
) => {
  const response = await http.request("/api/dashboard/pharmacy/medicines", {
    method: "POST",
    headers: dashboardHeaders(cookie),
    body: { unit: "viên", ...input },
  });
  assert.equal(response.status, 201);
  return response.body.data as { id: string; code: string; stockQuantity: number };
};

const receiveViaApi = async (cookie: string, medicineId: string, quantity: number) => {
  const response = await http.request(`/api/dashboard/pharmacy/medicines/${medicineId}/receipts`, {
    method: "POST",
    headers: dashboardHeaders(cookie),
    body: { quantity, reason: "Nhập theo phiếu" },
  });
  assert.equal(response.status, 201);
  return response.body.data as { stockQuantity: number };
};

const createIssuedPrescription = async (input: {
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

test("dashboard list endpoints support partial, case-insensitive search with q", async () => {
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");
  // Hồ sơ khám và đơn thuốc chỉ dành cho bác sĩ (quản trị không có quyền xem), nên dùng phiên bác sĩ cho hai danh sách đó.
  const doctorCookie = await authCookie(fixture.doctorOneUser.id, "DOCTOR");
  const list = async (path: string) => {
    const cookie = path.startsWith("/api/dashboard/prescriptions") || path.startsWith("/api/dashboard/medical-records") ? doctorCookie : adminCookie;
    const response = await http.request(path, { headers: dashboardHeaders(cookie) });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    return response.body.data.items as unknown[];
  };

  const { prescription } = await createIssuedPrescription({
    code: "RX-QSEARCH",
    phone: "0944444444",
    timeSlotId: fixture.slotOne.id,
    items: [{ medicineName: "Thuốc tìm kiếm", quantity: 1 }],
  });
  assert.ok(prescription.id);

  // Lịch hẹn: mã lịch gõ dở, không phân biệt hoa thường, hoặc số điện thoại gõ dở.
  assert.equal((await list("/api/dashboard/appointments?q=qsearch")).length, 1);
  assert.equal((await list("/api/dashboard/appointments?q=0944")).length, 1);
  assert.equal((await list("/api/dashboard/appointments?q=khong-co-gi")).length, 0);

  // Đơn thuốc: mã đơn gõ dở hoặc mã hồ sơ gõ dở.
  assert.equal((await list("/api/dashboard/prescriptions?q=rx-qsea")).length, 1);
  assert.equal((await list("/api/dashboard/prescriptions?q=REC-RX")).length, 1);
  assert.equal((await list("/api/dashboard/prescriptions?q=khong-co-gi")).length, 0);

  // Hồ sơ khám: mã hồ sơ gõ dở hoặc mã lịch gõ dở.
  assert.equal((await list("/api/dashboard/medical-records?q=rec-rx")).length, 1);
  assert.equal((await list("/api/dashboard/medical-records?q=BK-RX")).length, 1);
  assert.equal((await list("/api/dashboard/medical-records?q=khong-co-gi")).length, 0);

  // Hóa đơn: mã hóa đơn gõ dở hoặc mã lịch gõ dở.
  const { invoice } = await createPayableInvoice({ bookingCode: "QINV-001", phone: "0955555555", timeSlotId: fixture.slotTwo.id });
  assert.equal((await list(`/api/dashboard/invoices?q=${invoice.invoiceCode.slice(0, 8).toLowerCase()}`)).length, 1);
  assert.equal((await list("/api/dashboard/invoices?q=qinv")).length, 1);
  assert.equal((await list("/api/dashboard/invoices?q=khong-co-gi")).length, 0);
});

test("pharmacy endpoints are limited to the pharmacist role", async () => {
  const pharmacist = await createDashboardUser("PHARMACIST", "0900000012");
  const staff = await createDashboardUser("STAFF", "0900000011");
  const pharmacistCookie = await authCookie(pharmacist.id, "PHARMACIST");
  const request = (path: string, cookie: string, method = "GET", body?: unknown) =>
    http.request(`/api/dashboard/pharmacy${path}`, {
      method,
      headers: dashboardHeaders(cookie),
      body,
    });

  for (const cookie of [
    await authCookie(staff.id, "STAFF"),
    await authCookie(fixture.doctorOneUser.id, "DOCTOR"),
    await authCookie(fixture.adminUser.id, "ADMIN"),
  ]) {
    assert.equal((await request("/medicines", cookie)).status, 403);
    assert.equal((await request("/prescriptions", cookie)).status, 403);
    assert.equal(
      (await request("/medicines", cookie, "POST", { code: "X1", name: "X", unit: "viên" })).status,
      403,
    );
  }
  assert.equal((await request("/medicines", pharmacistCookie)).status, 200);
  assert.equal((await request("/prescriptions", pharmacistCookie)).status, 200);
});

test("stock changes only through the ledger and never goes negative", async () => {
  const pharmacist = await createDashboardUser("PHARMACIST", "0900000012");
  const cookie = await authCookie(pharmacist.id, "PHARMACIST");
  const medicine = await createMedicineViaApi(cookie, { code: "para500", name: "Paracetamol 500mg", minStock: 20 });
  assert.equal(medicine.code, "PARA500");
  assert.equal(medicine.stockQuantity, 0);

  const duplicate = await http.request("/api/dashboard/pharmacy/medicines", {
    method: "POST",
    headers: dashboardHeaders(cookie),
    body: { code: "PARA500", name: "Trùng", unit: "viên" },
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.code, "MEDICINE_CODE_EXISTS");

  // Sửa thuốc không đụng tới tồn.
  const edited = await http.request(`/api/dashboard/pharmacy/medicines/${medicine.id}`, {
    method: "PATCH",
    headers: dashboardHeaders(cookie),
    body: { name: "Paracetamol 500mg (hộp 100)", stockQuantity: 999 },
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.data.stockQuantity, 0);

  assert.equal((await receiveViaApi(cookie, medicine.id, 50)).stockQuantity, 50);

  const adjust = (delta: number, reason?: string) =>
    http.request(`/api/dashboard/pharmacy/medicines/${medicine.id}/adjustments`, {
      method: "POST",
      headers: dashboardHeaders(cookie),
      body: { delta, reason },
    });
  assert.equal((await adjust(-5)).status, 400);
  assert.equal((await adjust(-5, "Kiểm kê thiếu")).body.data.stockQuantity, 45);
  const tooMuch = await adjust(-100, "Hủy thuốc hết hạn");
  assert.equal(tooMuch.status, 409);
  assert.equal(tooMuch.body.code, "INSUFFICIENT_STOCK");
  assert.equal((await adjust(0, "Không đổi")).status, 400);

  const negativeReceipt = await http.request(
    `/api/dashboard/pharmacy/medicines/${medicine.id}/receipts`,
    { method: "POST", headers: dashboardHeaders(cookie), body: { quantity: -3 } },
  );
  assert.equal(negativeReceipt.status, 400);

  // Tồn luôn bằng tổng sổ kho; sổ kho chỉ thêm, không sửa hay xóa.
  const movements = await prisma.stockMovement.findMany({
    where: { medicineId: medicine.id },
    orderBy: { createdAt: "asc" },
  });
  assert.deepEqual(
    movements.map((item) => [item.type, item.quantity, item.balanceAfter]),
    [
      ["RECEIPT", 50, 50],
      ["ADJUSTMENT", -5, 45],
    ],
  );
  await assert.rejects(() =>
    prisma.stockMovement.update({ where: { id: movements[0].id }, data: { quantity: 999 } }),
  );
  await assert.rejects(() => prisma.stockMovement.delete({ where: { id: movements[0].id } }));

  const low = await http.request("/api/dashboard/pharmacy/medicines?lowStock=true", {
    headers: dashboardHeaders(cookie),
  });
  assert.equal(low.body.data.items.length, 0);
  await adjust(-30, "Hủy thuốc hết hạn");
  const lowAfter = await http.request("/api/dashboard/pharmacy/medicines?lowStock=true", {
    headers: dashboardHeaders(cookie),
  });
  assert.deepEqual(lowAfter.body.data.items.map((item: { code: string }) => item.code), ["PARA500"]);

  const history = await http.request(`/api/dashboard/pharmacy/medicines/${medicine.id}/movements`, {
    headers: dashboardHeaders(cookie),
  });
  assert.equal(history.status, 200);
  assert.equal(history.body.data.items.length, 3);
});

test("dispensing deducts stock for the whole prescription or not at all", async () => {
  const pharmacist = await createDashboardUser("PHARMACIST", "0900000012");
  const cookie = await authCookie(pharmacist.id, "PHARMACIST");
  const medicineA = await createMedicineViaApi(cookie, { code: "MED-A", name: "Thuốc A" });
  const medicineB = await createMedicineViaApi(cookie, { code: "MED-B", name: "Thuốc B" });
  await receiveViaApi(cookie, medicineA.id, 10);
  await receiveViaApi(cookie, medicineB.id, 3);

  const { appointment, prescription } = await createIssuedPrescription({
    code: "RX-DISPENSE",
    phone: "0911111111",
    timeSlotId: fixture.slotTwo.id,
    items: [
      { medicineName: "Thuốc A", quantity: 6, medicineId: medicineA.id },
      { medicineName: "Thuốc B", quantity: 5, medicineId: medicineB.id },
      { medicineName: "Thuốc mua ngoài", quantity: 2 },
    ],
  });
  const dispense = (body: unknown) =>
    http.request(`/api/dashboard/pharmacy/prescriptions/${prescription.id}/dispense`, {
      method: "POST",
      headers: dashboardHeaders(cookie),
      body,
    });
  const stock = async (id: string) =>
    (await prisma.medicine.findUniqueOrThrow({ where: { id } })).stockQuantity;

  // Hàng đợi chỉ có đơn đã phát hành chưa cấp.
  const queue = await http.request("/api/dashboard/pharmacy/prescriptions", {
    headers: dashboardHeaders(cookie),
  });
  assert.deepEqual(
    queue.body.data.items.map((item: { prescriptionCode: string }) => item.prescriptionCode),
    ["RX-DISPENSE"],
  );

  // Chưa tick xác nhận kiểm tra: từ chối.
  const unconfirmed = await dispense({ confirmed: false });
  assert.equal(unconfirmed.status, 400);
  assert.equal(unconfirmed.body.code, "DISPENSE_CONFIRMATION_REQUIRED");

  // Thuốc B thiếu (cần 5, còn 3): cả đơn không được cấp, thuốc A cũng không bị trừ.
  const short = await dispense({ confirmed: true });
  assert.equal(short.status, 409);
  assert.equal(short.body.code, "INSUFFICIENT_STOCK");
  assert.equal(await stock(medicineA.id), 10);
  assert.equal(await stock(medicineB.id), 3);
  const untouched = await prisma.prescription.findUniqueOrThrow({ where: { id: prescription.id } });
  assert.equal(untouched.dispenseStatus, "NOT_DISPENSED");
  assert.equal(untouched.dispensedById, null);
  assert.equal(
    await prisma.stockMovement.count({ where: { type: "DISPENSE" } }),
    0,
  );

  await receiveViaApi(cookie, medicineB.id, 5);
  const ok = await dispense({ confirmed: true, note: "Đã đối chiếu dị ứng" });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.dispenseStatus, "DISPENSED");
  assert.equal(await stock(medicineA.id), 4);
  assert.equal(await stock(medicineB.id), 3);

  const dispensed = await prisma.prescription.findUniqueOrThrow({
    where: { id: prescription.id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  assert.equal(dispensed.dispensedById, pharmacist.id);
  assert.equal(dispensed.dispenseNote, "Đã đối chiếu dị ứng");
  assert.deepEqual(
    dispensed.items.map((item) => item.dispensedQuantity),
    [6, 5, 0],
  );
  const movements = await prisma.stockMovement.findMany({
    where: { type: "DISPENSE" },
    orderBy: { quantity: "desc" },
  });
  assert.deepEqual(
    movements.map((item) => [item.quantity, item.balanceAfter, item.actorId]),
    [
      [-5, 3, pharmacist.id],
      [-6, 4, pharmacist.id],
    ],
  );

  // Dấu vết lâm sàng và thông báo cho người khám.
  assert.equal(
    await prisma.appointmentLog.count({
      where: { appointmentId: appointment.id, action: "PRESCRIPTION_DISPENSED" },
    }),
    1,
  );
  assert.equal(
    await prisma.notification.count({
      where: { userId: appointment.patientId, type: "PRESCRIPTION_DISPENSED" },
    }),
    1,
  );

  // Cấp lần hai bị chặn, đơn đã cấp không hủy được và rời hàng đợi.
  const again = await dispense({ confirmed: true });
  assert.equal(again.status, 409);
  assert.equal(again.body.code, "ALREADY_DISPENSED");
  assert.equal(await stock(medicineA.id), 4);
  await assert.rejects(
    () => PrescriptionService.cancel(prescription.id, { userId: fixture.adminUser.id, role: "ADMIN" }),
    (error: { code?: string }) => error.code === "PRESCRIPTION_DISPENSED",
  );
  const emptyQueue = await http.request("/api/dashboard/pharmacy/prescriptions", {
    headers: dashboardHeaders(cookie),
  });
  assert.equal(emptyQueue.body.data.items.length, 0);
  const done = await http.request(
    "/api/dashboard/pharmacy/prescriptions?dispenseStatus=DISPENSED",
    { headers: dashboardHeaders(cookie) },
  );
  assert.equal(done.body.data.items.length, 1);
});

test("two pharmacists dispensing the same prescription deduct stock once", async () => {
  const pharmacist = await createDashboardUser("PHARMACIST", "0900000012");
  const cookie = await authCookie(pharmacist.id, "PHARMACIST");
  const medicine = await createMedicineViaApi(cookie, { code: "MED-C", name: "Thuốc C" });
  await receiveViaApi(cookie, medicine.id, 10);

  // Dòng đơn chưa gắn thuốc kho: dược sĩ chọn thuốc khi cấp.
  const { prescription } = await createIssuedPrescription({
    code: "RX-RACE",
    phone: "0922222222",
    timeSlotId: fixture.slotOne.id,
    items: [{ medicineName: "Thuốc C (gõ tay)", quantity: 4 }],
  });
  const body = {
    confirmed: true,
    lines: [{ itemId: prescription.items[0].id, medicineId: medicine.id }],
  };
  const responses = await Promise.all(
    [1, 2].map(() =>
      http.request(`/api/dashboard/pharmacy/prescriptions/${prescription.id}/dispense`, {
        method: "POST",
        headers: dashboardHeaders(cookie),
        body,
      }),
    ),
  );
  responses.sort((left, right) => left.status - right.status);
  assert.equal(responses[0].status, 200);
  assert.equal(responses[1].status, 409);

  assert.equal(
    (await prisma.medicine.findUniqueOrThrow({ where: { id: medicine.id } })).stockQuantity,
    6,
  );
  assert.equal(await prisma.stockMovement.count({ where: { type: "DISPENSE" } }), 1);
  const item = await prisma.prescriptionItem.findUniqueOrThrow({
    where: { id: prescription.items[0].id },
  });
  assert.equal(item.medicineId, medicine.id);
  assert.equal(item.dispensedQuantity, 4);
});

test("patients review only their own completed appointments", async () => {
  const completed = await createStoredAppointment({
    status: "COMPLETED",
    bookingCode: "PORTAL-REVIEW",
  });
  const ownerAuthorization = `Bearer ${(await loginPatient(completed.patientPhone)).accessToken}`;
  const reviewPath = `/api/v1/me/appointments/${completed.id}/review`;
  const body = { doctorRating: 5, serviceRating: 4, facilityRating: 3, comment: "Tốt" };

  const anonymous = await http.request(reviewPath, { method: "POST", body });
  assert.equal(anonymous.status, 401);

  await prisma.user.create({
    data: { fullName: "Review Patient B", phone: "0955555555", role: "PATIENT", isPhoneVerified: true },
  });
  const otherAuthorization = `Bearer ${(await loginPatient("0955555555")).accessToken}`;
  const crossPatient = await http.request(reviewPath, {
    method: "POST",
    headers: { authorization: otherAuthorization },
    body,
  });
  assert.equal(crossPatient.status, 404);

  const created = await http.request(reviewPath, {
    method: "POST",
    headers: { authorization: ownerAuthorization },
    body,
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.rating, 4);
  assert.equal(created.body.data.isVisible, false);

  const duplicate = await http.request(reviewPath, {
    method: "POST",
    headers: { authorization: ownerAuthorization },
    body,
  });
  assert.equal(duplicate.status, 409);

  const read = await http.request(reviewPath, { headers: { authorization: ownerAuthorization } });
  assert.equal(read.status, 200);
  assert.equal(read.body.data.id, created.body.data.id);
});

test("legacy API responses keep the success/message/data envelope", async () => {
  const response = await http.request("/api/appointments", {
    method: "POST",
    body: bookingBody({ phone: "0912345678" }),
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(typeof response.body.message, "string");
  assert.equal(typeof response.body.data, "object");
});

test("the same OTP can be consumed by exactly one concurrent request", async () => {
  const target = "0922222222";
  const sent = await AuthOtpService.sendOtp(
    target,
    "PATIENT_PORTAL_LOGIN",
    "phase0-otp-concurrency",
  );
  assert.ok(sent.debugOtp);

  const attempts = await Promise.allSettled(
    Array.from({ length: 20 }, () =>
      AuthOtpService.verifyOtp(target, sent.debugOtp!, "PATIENT_PORTAL_LOGIN"),
    ),
  );

  const successfulAttempts = attempts.filter(
    (attempt) => attempt.status === "fulfilled",
  );
  assert.equal(successfulAttempts.length, 1);

  const storedOtp = await prisma.otpCode.findUniqueOrThrow({
    where: { id: sent.id },
    select: { isUsed: true, usedAt: true },
  });
  assert.equal(storedOtp.isUsed, true);
  assert.ok(storedOtp.usedAt);

  const successfulAuditRecords = await prisma.otpVerifyAttempt.count({
    where: {
      target,
      purpose: "PATIENT_PORTAL_LOGIN",
      success: true,
    },
  });
  assert.equal(successfulAuditRecords, 1);
});

test("patient v1 auth scopes profile and resources to the authenticated owner", async () => {
  const patient = await prisma.user.create({
    data: {
      fullName: "Phase One Patient",
      phone: "0981111111",
      role: "PATIENT",
      isPhoneVerified: true,
      patientProfile: { create: { address: "Old address" } },
    },
  });
  const otherPatient = await prisma.user.create({
    data: {
      fullName: "Other Patient",
      phone: "0982222222",
      role: "PATIENT",
      isPhoneVerified: true,
    },
  });
  const appointmentPackage = await prisma.package.create({
    data: {
      name: "Phase One Patient Package",
      slug: "phase-one-patient-package",
      basePrice: 300000,
      departmentId: fixture.department.id,
    },
  });
  const ownAppointment = await prisma.appointment.create({
    data: {
      bookingCode: "PHASE1-OWN",
      appointmentDate: dateOnly(fixture.appointmentDate),
      startTime: "13:00",
      endTime: "13:30",
      status: "COMPLETED",
      patientName: patient.fullName,
      patientPhone: patient.phone!,
      patientId: patient.id,
      doctorId: fixture.doctorOne.id,
      departmentId: fixture.department.id,
      packageId: appointmentPackage.id,
      completedAt: new Date(),
    },
  });
  const otherAppointment = await prisma.appointment.create({
    data: {
      bookingCode: "PHASE1-OTHER",
      appointmentDate: dateOnly(fixture.appointmentDate),
      startTime: "14:00",
      endTime: "14:30",
      status: "COMPLETED",
      patientName: otherPatient.fullName,
      patientPhone: otherPatient.phone!,
      patientId: otherPatient.id,
      doctorId: fixture.doctorOne.id,
      departmentId: fixture.department.id,
      completedAt: new Date(),
    },
  });
  const record = await prisma.medicalRecord.create({
    data: {
      recordCode: "PHASE1-RECORD",
      appointmentId: ownAppointment.id,
      patientId: patient.id,
      doctorId: fixture.doctorOne.id,
      status: "PUBLISHED",
      diagnosis: "Patient-owned diagnosis",
      resultPdfUrl: "https://res.cloudinary.com/demo/image/upload/result.png",
      publishedAt: new Date(),
      labResults: {
        create: {
          testName: "Blood test",
          resultValue: "Normal",
          fileUrl: "https://res.cloudinary.com/demo/image/upload/lab.png",
        },
      },
    },
  });
  const otherRecord = await prisma.medicalRecord.create({
    data: {
      recordCode: "PHASE1-OTHER-RECORD",
      appointmentId: otherAppointment.id,
      patientId: otherPatient.id,
      doctorId: fixture.doctorOne.id,
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });
  const prescription = await prisma.prescription.create({
    data: {
      prescriptionCode: "PHASE1-PRESCRIPTION",
      medicalRecordId: record.id,
      appointmentId: ownAppointment.id,
      patientId: patient.id,
      doctorId: fixture.doctorOne.id,
      status: "ISSUED",
      issuedAt: new Date(),
      items: { create: { medicineName: "Paracetamol", sortOrder: 0 } },
    },
  });
  const invoice = await prisma.invoice.create({
    data: {
      invoiceCode: "PHASE1-INVOICE",
      barcode: "PHASE1-PRIVATE-BARCODE",
      appointmentId: ownAppointment.id,
      patientId: patient.id,
      totalAmount: 300000,
      finalAmount: 300000,
    },
  });

  const auth = await loginPatient(patient.phone!);
  const authorization = `Bearer ${auth.accessToken}`;

  const me = await http.request("/api/v1/me", { headers: { authorization } });
  assert.equal(me.status, 200);
  assert.equal(me.body.data.id, patient.id);

  const updated = await http.request("/api/v1/me", {
    method: "PATCH",
    headers: { authorization },
    body: { fullName: "Updated Patient", address: "New address" },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.fullName, "Updated Patient");
  assert.equal(updated.body.data.patientProfile.address, "New address");

  const appointments = await http.request("/api/v1/me/appointments?limit=999", {
    headers: { authorization },
  });
  assert.equal(appointments.status, 200);
  assert.equal(appointments.body.data.length, 1);
  assert.equal(appointments.body.data[0].id, ownAppointment.id);
  assert.equal(appointments.body.data[0].package.id, appointmentPackage.id);
  assert.equal(appointments.body.meta.limit, 50);
  assert.equal(appointments.body.meta.hasPreviousPage, false);
  assert.ok(
    Number(appointments.headers.get("x-database-query-count")) <= 3,
    "appointment list should use one auth query and at most two read queries",
  );

  const completedAppointments = await http.request(
    "/api/v1/me/appointments?status=COMPLETED",
    { headers: { authorization } },
  );
  assert.equal(completedAppointments.status, 200);
  assert.equal(completedAppointments.body.data.length, 1);
  assert.equal(completedAppointments.body.data[0].id, ownAppointment.id);

  const appointmentDetail = await http.request(
    `/api/v1/me/appointments/${ownAppointment.id}`,
    { headers: { authorization } },
  );
  assert.equal(appointmentDetail.status, 200);
  assert.equal(appointmentDetail.body.data.id, ownAppointment.id);
  assert.equal(appointmentDetail.body.data.doctor.id, fixture.doctorOne.id);
  assert.ok(
    Number(appointmentDetail.headers.get("x-database-query-count")) <= 2,
    "appointment detail should use one auth query and one joined read query",
  );

  const medical = await http.request("/api/v1/me/medical-records", {
    headers: { authorization },
  });
  assert.equal(medical.status, 200);
  assert.equal(medical.body.data[0].id, record.id);
  assert.equal(medical.body.data[0].resultPdfUrl, undefined);
  assert.match(medical.body.data[0].resultFile.downloadUrl, /^\/api\/v1\/me\//);
  assert.equal(medical.body.data[0].labResults[0].fileUrl, undefined);

  const prescriptions = await http.request("/api/v1/me/prescriptions", {
    headers: { authorization },
  });
  assert.equal(prescriptions.status, 200);
  assert.equal(prescriptions.body.data[0].id, prescription.id);
  assert.equal(prescriptions.body.data[0].items[0].medicineName, "Paracetamol");

  const invoices = await http.request("/api/v1/me/invoices", {
    headers: { authorization },
  });
  assert.equal(invoices.status, 200);
  assert.equal(invoices.body.data[0].id, invoice.id);
  assert.equal(invoices.body.data[0].barcode, undefined);

  const paymentCapabilities = await http.request(
    "/api/v1/me/payment-capabilities",
    { headers: { authorization } },
  );
  assert.equal(paymentCapabilities.status, 200);
  assert.ok(
    paymentCapabilities.body.data.providers.some(
      (provider: { provider: string }) => provider.provider === "VNPAY",
    ),
  );

  const patientPayment = await http.request(
    `/api/v1/me/invoices/${invoice.id}/payments`,
    {
      method: "POST",
      headers: {
        authorization,
        "idempotency-key": "phase1-mobile-payment",
      },
      body: { provider: "VNPAY" },
    },
  );
  assert.equal(patientPayment.status, 201);
  assert.equal(patientPayment.body.data.provider, "VNPAY");
  assert.equal(patientPayment.body.data.activeKey, undefined);
  assert.equal(patientPayment.body.data.idempotencyKey, undefined);
  assert.equal(patientPayment.body.data.rawResponse, undefined);

  const patientPaymentDetail = await http.request(
    `/api/v1/me/payments/${patientPayment.body.data.id}`,
    { headers: { authorization } },
  );
  assert.equal(patientPaymentDetail.status, 200);
  assert.equal(patientPaymentDetail.body.data.id, patientPayment.body.data.id);
  assert.equal(patientPaymentDetail.body.data.rawResponse, undefined);

  const crossPatient = await http.request(
    `/api/v1/me/medical-records/${otherRecord.id}`,
    { headers: { authorization } },
  );
  assert.equal(crossPatient.status, 404);

  await prisma.user.update({
    where: { id: patient.id },
    data: { isActive: false },
  });
  const deactivatedPatient = await http.request("/api/v1/me", {
    headers: { authorization },
  });
  assert.equal(deactivatedPatient.status, 401);

  const unauthenticated = await http.request("/api/v1/me/appointments");
  assert.equal(unauthenticated.status, 401);
});

test("dependent profiles stay owner-scoped and create appointments without overwriting the owner", async () => {
  const owner = await prisma.user.create({
    data: {
      fullName: "Dependent Owner",
      phone: "0981234501",
      email: "dependent.owner@example.test",
      role: "PATIENT",
      isPhoneVerified: true,
      patientProfile: { create: { address: "Owner address" } },
    },
  });
  const otherOwner = await prisma.user.create({
    data: {
      fullName: "Other Dependent Owner",
      phone: "0981234502",
      role: "PATIENT",
      isPhoneVerified: true,
    },
  });
  const ownerAuth = await loginPatient(owner.phone!);
  const otherAuth = await loginPatient(otherOwner.phone!);
  const authorization = `Bearer ${ownerAuth.accessToken}`;
  const otherAuthorization = `Bearer ${otherAuth.accessToken}`;

  const created = await http.request("/api/v1/me/dependents", {
    method: "POST",
    headers: { authorization },
    body: {
      fullName: "Child Patient",
      relationship: "CHILD",
      dateOfBirth: "2015-05-20",
      gender: "FEMALE",
      cccd: "079215000001",
      hasBHYT: true,
      healthInsuranceCode: "GD401010000001",
      consentConfirmed: true,
    },
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.fullName, "Child Patient");
  const dependentId = created.body.data.id as string;

  const listed = await http.request("/api/v1/me/dependents", {
    headers: { authorization },
  });
  assert.equal(listed.status, 200);
  assert.deepEqual(
    listed.body.data.map((item: { id: string }) => item.id),
    [dependentId],
  );

  const crossOwnerUpdate = await http.request(
    `/api/v1/me/dependents/${dependentId}`,
    {
      method: "PATCH",
      headers: { authorization: otherAuthorization },
      body: { fullName: "Should Not Change" },
    },
  );
  assert.equal(crossOwnerUpdate.status, 404);

  const guestBooking = await http.request("/api/v1/appointments", {
    method: "POST",
    body: {
      ...bookingBody({ phone: owner.phone! }),
      dependentProfileId: dependentId,
    },
  });
  assert.equal(guestBooking.status, 401);
  assert.equal(guestBooking.body.code, "AUTH_REQUIRED_FOR_DEPENDENT_BOOKING");

  const booking = await http.request("/api/v1/appointments", {
    method: "POST",
    headers: { authorization },
    body: {
      ...bookingBody({ phone: "0900000000" }),
      patientName: "Untrusted Client Name",
      dependentProfileId: dependentId,
    },
  });
  assert.equal(booking.status, 201);

  const pending = await prisma.appointment.findUniqueOrThrow({
    where: { id: booking.body.data.appointmentId },
  });
  assert.equal(pending.patientId, owner.id);
  assert.equal(pending.dependentProfileId, dependentId);
  assert.equal(pending.patientName, "Child Patient");
  assert.equal(pending.patientPhone, owner.phone);
  assert.equal(pending.patientCccd, "079215000001");

  const verified = await http.request(
    `/api/v1/appointments/${pending.id}/verify-otp`,
    {
      method: "POST",
      body: { otp: booking.body.data.debugOtp },
    },
  );
  assert.equal(verified.status, 200);

  const unchangedOwner = await prisma.user.findUniqueOrThrow({
    where: { id: owner.id },
    include: { patientProfile: true },
  });
  assert.equal(unchangedOwner.fullName, "Dependent Owner");
  assert.equal(unchangedOwner.patientProfile?.address, "Owner address");
  assert.equal(unchangedOwner.patientProfile?.cccd, null);

  const appointmentList = await http.request("/api/v1/me/appointments", {
    headers: { authorization },
  });
  assert.equal(appointmentList.status, 200);
  assert.equal(appointmentList.body.data[0].patientName, "Child Patient");
  assert.equal(appointmentList.body.data[0].recipientType, "DEPENDENT");
  assert.equal(appointmentList.body.data[0].dependentProfileId, dependentId);
  assert.equal(appointmentList.body.data[0].hasBHYT, true);

  const archived = await http.request(`/api/v1/me/dependents/${dependentId}`, {
    method: "DELETE",
    headers: { authorization },
  });
  assert.equal(archived.status, 200);
  assert.equal(archived.body.data.archived, true);

  const afterArchive = await http.request("/api/v1/me/dependents", {
    headers: { authorization },
  });
  assert.deepEqual(afterArchive.body.data, []);

  const archivedBooking = await http.request("/api/v1/appointments", {
    method: "POST",
    headers: { authorization },
    body: {
      ...bookingBody({ phone: owner.phone! }),
      dependentProfileId: dependentId,
    },
  });
  assert.equal(archivedBooking.status, 404);
  assert.equal(archivedBooking.body.code, "DEPENDENT_NOT_FOUND");

  const restored = await http.request("/api/v1/me/dependents", {
    method: "POST",
    headers: { authorization },
    body: {
      fullName: "Child Patient Updated",
      relationship: "CHILD",
      dateOfBirth: "2015-05-20",
      gender: "FEMALE",
      cccd: "079215000001",
      hasBHYT: false,
      consentConfirmed: true,
    },
  });
  assert.equal(restored.status, 201);
  assert.equal(restored.body.data.id, dependentId);
  assert.equal(restored.body.data.fullName, "Child Patient Updated");
  assert.equal(restored.body.data.isActive, true);

  const historicalAppointment = await prisma.appointment.findUniqueOrThrow({
    where: { id: pending.id },
  });
  assert.equal(historicalAppointment.dependentProfileId, dependentId);
});

test("patient refresh rotation detects reuse and revokes the token family", async () => {
  const auth = await loginPatient("0983333333");

  const refreshed = await http.request("/api/v1/auth/refresh", {
    method: "POST",
    body: { refreshToken: auth.refreshToken, platform: "android" },
  });
  assert.equal(refreshed.status, 200);
  assert.notEqual(refreshed.body.data.refreshToken, auth.refreshToken);

  const reused = await http.request("/api/v1/auth/refresh", {
    method: "POST",
    body: { refreshToken: auth.refreshToken },
  });
  assert.equal(reused.status, 401);
  assert.equal(reused.body.code, "REFRESH_TOKEN_REUSE");

  const revokedAccess = await http.request("/api/v1/me", {
    headers: {
      authorization: `Bearer ${refreshed.body.data.accessToken}`,
    },
  });
  assert.equal(revokedAccess.status, 401);
});

test("patient can list devices and revoke another session", async () => {
  const first = await loginPatient("0984444444");
  const second = await AuthSessionService.create({
    userId: first.user.id,
    kind: "PATIENT",
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    meta: {
      deviceId: "second-device",
      deviceName: "Second device",
      platform: "ios",
    },
  });
  const authorization = `Bearer ${first.accessToken}`;

  const sessions = await http.request("/api/v1/auth/sessions", {
    headers: { authorization },
  });
  assert.equal(sessions.status, 200);
  assert.equal(sessions.body.data.length, 2);
  const other = sessions.body.data.find(
    (item: { isCurrent: boolean }) => !item.isCurrent,
  );
  assert.ok(other);

  const revoked = await http.request(`/api/v1/auth/sessions/${other.id}`, {
    method: "DELETE",
    headers: { authorization },
  });
  assert.equal(revoked.status, 200);

  const rejectedRefresh = await http.request("/api/v1/auth/refresh", {
    method: "POST",
    body: { refreshToken: second.refreshToken },
  });
  assert.equal(rejectedRefresh.status, 401);
});

test("appointment confirmation creates a private notification and reminder", async () => {
  const appointment = await createStoredAppointment({
    status: "PENDING_CONFIRM",
    bookingCode: "NOTIFY-CONFIRMED",
  });
  const session = await AuthSessionService.create({
    userId: appointment.patientId,
    kind: "PATIENT",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  await AuthSessionService.registerPushToken({
    sessionId: session.session.id,
    userId: appointment.patientId,
    kind: "PATIENT",
    pushToken: "notification-delivery-integration-token",
    platform: "android",
  });

  await AppointmentService.confirm(appointment.id, {
    userId: fixture.adminUser.id,
    role: "ADMIN",
  });

  const notifications = await prisma.notification.findMany({
    where: { userId: appointment.patientId },
    include: { deliveries: true },
  });
  assert.equal(notifications.length, 2);
  const confirmation = notifications.find(
    (item) => item.type === "APPOINTMENT_CONFIRMED",
  );
  const reminder = notifications.find(
    (item) => item.type === "APPOINTMENT_REMINDER",
  );
  assert.ok(confirmation);
  assert.ok(reminder);
  assert.equal(confirmation.entityType, "APPOINTMENT");
  assert.equal(confirmation.entityId, appointment.id);
  assert.equal(
    confirmation.dedupeKey,
    `appointment:${appointment.id}:confirmed`,
  );
  assert.equal(confirmation.deliveries.length, 1);
  assert.equal(
    confirmation.deliveries[0]?.sessionId,
    session.session.id,
  );
  assert.equal(reminder.entityId, appointment.id);
  assert.equal(reminder.deliveries.length, 1);
  assert.ok(reminder.expiresAt);
  assert.ok(reminder.scheduledAt <= reminder.expiresAt);
});

test("dashboard cancellation creates one private inbox notification", async () => {
  const appointment = await createStoredAppointment({
    status: "CONFIRMED",
    bookingCode: "NOTIFY-CANCELLED",
  });

  await AppointmentService.cancel(
    appointment.id,
    "Bác sĩ bận đột xuất",
    { userId: fixture.adminUser.id, role: "ADMIN" },
  );

  const notification = await prisma.notification.findFirstOrThrow({
    where: { userId: appointment.patientId },
  });
  assert.equal(notification.type, "APPOINTMENT_CANCELLED");
  assert.equal(notification.entityId, appointment.id);
  assert.match(notification.body, /Bác sĩ bận đột xuất/);
});

test("no-show cancels reminders and creates a patient notification", async () => {
  const appointment = await createStoredAppointment({
    status: "CONFIRMED",
    bookingCode: "NOTIFY-NO-SHOW",
  });
  await NotificationService.create({
    userId: appointment.patientId,
    type: "APPOINTMENT_REMINDER",
    title: "Nhắc lịch khám",
    body: "Bạn có lịch khám sắp tới.",
    entityType: "APPOINTMENT",
    entityId: appointment.id,
    dedupeKey: `appointment:${appointment.id}:reminder:test`,
    scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
    publishedAt: null,
  });

  await AppointmentService.markNoShow(appointment.id, {
    userId: fixture.adminUser.id,
    role: "ADMIN",
  });

  const notifications = await prisma.notification.findMany({
    where: { userId: appointment.patientId },
  });
  const reminder = notifications.find(
    (item) => item.type === "APPOINTMENT_REMINDER",
  );
  const noShow = notifications.find(
    (item) => item.type === "APPOINTMENT_NO_SHOW",
  );
  assert.ok(reminder?.cancelledAt);
  assert.ok(noShow);
  assert.equal(noShow.entityId, appointment.id);
  assert.equal(noShow.dedupeKey, `appointment:${appointment.id}:no-show`);
});

test("care progress states create one deep-linkable notification each", async () => {
  const appointment = await createStoredAppointment({
    status: "CONFIRMED",
    bookingCode: "NOTIFY-PROGRESS",
  });
  const actor = { userId: fixture.adminUser.id, role: "ADMIN" as const };

  await AppointmentService.checkIn(appointment.id, actor);
  await AppointmentService.start(appointment.id, actor);
  await AppointmentService.complete(appointment.id, actor);

  const notifications = await prisma.notification.findMany({
    where: { userId: appointment.patientId },
    orderBy: { createdAt: "asc" },
  });
  assert.deepEqual(
    notifications.map((item) => item.type),
    [
      "APPOINTMENT_CHECKED_IN",
      "APPOINTMENT_IN_PROGRESS",
      "APPOINTMENT_COMPLETED",
    ],
  );
  assert.deepEqual(
    notifications.map((item) => item.entityId),
    [appointment.id, appointment.id, appointment.id],
  );
  assert.deepEqual(
    notifications.map((item) => item.dedupeKey),
    [
      `appointment:${appointment.id}:checked-in`,
      `appointment:${appointment.id}:in-progress`,
      `appointment:${appointment.id}:completed`,
    ],
  );
});

test("rescheduling preserves history, moves the slot and notifies the patient", async () => {
  const appointment = await createStoredAppointment({
    status: "CONFIRMED",
    bookingCode: "NOTIFY-RESCHEDULED",
  });
  await NotificationService.create({
    userId: appointment.patientId,
    type: "APPOINTMENT_REMINDER",
    title: "Nhắc lịch khám",
    body: "Bạn có lịch khám sắp tới.",
    entityType: "APPOINTMENT",
    entityId: appointment.id,
    dedupeKey: `appointment:${appointment.id}:reminder:test`,
    scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
    publishedAt: null,
  });

  const rescheduled = await AppointmentService.reschedule(
    appointment.id,
    {
      timeSlotId: fixture.slotOne.id,
      reason: "Bác sĩ thay đổi lịch làm việc",
    },
    { userId: fixture.adminUser.id, role: "ADMIN" },
  );

  const [oldAppointment, newAppointment, oldSlot, targetSlot, notifications] =
    await Promise.all([
      prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } }),
      prisma.appointment.findUniqueOrThrow({ where: { id: rescheduled.id } }),
      prisma.doctorTimeSlot.findUniqueOrThrow({ where: { id: fixture.slotTwo.id } }),
      prisma.doctorTimeSlot.findUniqueOrThrow({ where: { id: fixture.slotOne.id } }),
      prisma.notification.findMany({ where: { userId: appointment.patientId } }),
    ]);

  assert.equal(oldAppointment.status, "RESCHEDULED");
  assert.equal(oldAppointment.timeSlotId, null);
  assert.equal(oldSlot.status, "AVAILABLE");
  assert.equal(rescheduled.status, "CONFIRMED");
  assert.equal(newAppointment.timeSlotId, fixture.slotOne.id);
  assert.equal(newAppointment.rescheduledFromId, appointment.id);
  assert.equal(targetSlot.status, "BOOKED");
  assert.ok(
    notifications.find(
      (item) =>
        item.type === "APPOINTMENT_RESCHEDULED" &&
        item.entityId === rescheduled.id,
    ),
  );
  assert.ok(
    notifications.find(
      (item) =>
        item.type === "APPOINTMENT_REMINDER" &&
        item.entityId === appointment.id,
    )?.cancelledAt,
  );
  assert.ok(
    notifications.find(
      (item) =>
        item.type === "APPOINTMENT_REMINDER" &&
        item.entityId === rescheduled.id,
    ),
  );
});

test("clinical and billing transitions create deep-linkable patient notifications", async () => {
  const appointment = await createStoredAppointment({
    status: "COMPLETED",
    bookingCode: "NOTIFY-CARE-JOURNEY",
  });
  const record = await prisma.medicalRecord.create({
    data: {
      recordCode: "NOTIFY-RECORD",
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      status: "DRAFT",
    },
  });
  const prescription = await prisma.prescription.create({
    data: {
      prescriptionCode: "NOTIFY-PRESCRIPTION",
      medicalRecordId: record.id,
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      status: "DRAFT",
      items: {
        create: {
          medicineName: "Mock medicine",
          sortOrder: 0,
        },
      },
    },
  });
  const actor = { userId: fixture.adminUser.id, role: "ADMIN" as const };

  await MedicalRecordService.publish(record.id, actor);
  await PrescriptionService.issue(prescription.id, actor);
  const invoice = await InvoiceService.createForAppointment(appointment.id, {});
  assert.deepEqual(
    invoice.items.map((item) => ({
      type: item.type,
      amount: item.amount,
      quantity: item.quantity,
    })),
    [{ type: "CONSULTATION", amount: 300000, quantity: 1 }],
  );
  assert.equal(
    invoice.items.reduce((sum, item) => sum + item.amount, 0),
    invoice.totalAmount,
  );
  await InvoiceService.pay(invoice.id, { paymentMethod: "CASH" });
  await InvoiceService.refund(invoice.id, { refundReason: "Integration test" });

  const notifications = await prisma.notification.findMany({
    where: { userId: appointment.patientId },
    orderBy: { createdAt: "asc" },
  });
  assert.deepEqual(
    notifications.map((item) => item.type),
    [
      "MEDICAL_RESULT_PUBLISHED",
      "PRESCRIPTION_ISSUED",
      "INVOICE_CREATED",
      "PAYMENT_SUCCEEDED",
      "PAYMENT_REFUNDED",
    ],
  );
  assert.deepEqual(
    notifications.map((item) => item.entityType),
    ["MEDICAL_RECORD", "PRESCRIPTION", "INVOICE", "INVOICE", "INVOICE"],
  );
  assert.deepEqual(
    notifications.map((item) => item.entityId),
    [record.id, prescription.id, invoice.id, invoice.id, invoice.id],
  );
  assert.equal(new Set(notifications.map((item) => item.dedupeKey)).size, 5);
});

test("dashboard hospital announcements reuse the patient inbox and support scheduling", async () => {
  const [activeOne, activeTwo] = await Promise.all([
    prisma.user.create({
      data: {
        fullName: "Announcement Patient One",
        phone: "0987000001",
        role: "PATIENT",
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        fullName: "Announcement Patient Two",
        phone: "0987000002",
        role: "PATIENT",
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        fullName: "Inactive Announcement Patient",
        phone: "0987000003",
        role: "PATIENT",
        isActive: false,
      },
    }),
  ]);
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");
  const patientSession = await AuthSessionService.create({
    userId: activeOne.id,
    kind: "PATIENT",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  await AuthSessionService.registerPushToken({
    sessionId: patientSession.session.id,
    userId: activeOne.id,
    kind: "PATIENT",
    pushToken: "hospital-announcement-integration-token",
    platform: "android",
  });

  const immediate = await http.request("/api/dashboard/notifications", {
    method: "POST",
    headers: dashboardHeaders(adminCookie),
    body: {
      title: "Lịch làm việc cuối tuần",
      body: "Bệnh viện cập nhật giờ tiếp nhận vào cuối tuần này.",
    },
  });
  assert.equal(immediate.status, 201);
  assert.equal(immediate.body.data.recipientCount, 2);
  assert.equal(immediate.body.data.deliveryCount, 1);
  assert.ok(immediate.body.data.publishedAt);

  const stored = await prisma.notification.findMany({
    where: { campaignId: immediate.body.data.campaignId },
    orderBy: { userId: "asc" },
  });
  assert.equal(stored.length, 2);
  assert.deepEqual(
    new Set(stored.map((item) => item.userId)),
    new Set([activeOne.id, activeTwo.id]),
  );
  assert.ok(stored.every((item) => item.type === "SYSTEM_ANNOUNCEMENT"));
  assert.ok(stored.every((item) => item.createdById === fixture.adminUser.id));

  const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const scheduled = await http.request("/api/dashboard/notifications", {
    method: "POST",
    headers: dashboardHeaders(adminCookie),
    body: {
      title: "Thông báo bảo trì",
      body: "Ứng dụng sẽ được bảo trì trong thời gian ngắn.",
      scheduledAt,
    },
  });
  assert.equal(scheduled.status, 201);
  assert.equal(scheduled.body.data.publishedAt, null);

  const history = await http.request("/api/dashboard/notifications", {
    headers: dashboardHeaders(adminCookie),
  });
  assert.equal(history.status, 200);
  assert.equal(history.body.data.items.length, 2);
  assert.equal(history.body.data.items[0].recipientCount, 2);

  const cancelled = await http.request(
    `/api/dashboard/notifications/${scheduled.body.data.campaignId}/cancel`,
    { method: "PATCH", headers: dashboardHeaders(adminCookie) },
  );
  assert.equal(cancelled.status, 200);
  const cancelledCount = await prisma.notification.count({
    where: {
      campaignId: scheduled.body.data.campaignId,
      cancelledAt: { not: null },
    },
  });
  assert.equal(cancelledCount, 2);
  const cancelledDeliveries = await prisma.notificationDelivery.count({
    where: {
      notification: { campaignId: scheduled.body.data.campaignId },
      status: "CANCELLED",
    },
  });
  assert.equal(cancelledDeliveries, 1);

  await prisma.appointment.create({
    data: {
      bookingCode: "ANNOUNCEMENT-AUDIENCE-1",
      appointmentDate: dateOnly(fixture.appointmentDate),
      startTime: fixture.slotOne.startTime,
      endTime: fixture.slotOne.endTime,
      status: "CONFIRMED",
      patientName: activeOne.fullName,
      patientPhone: activeOne.phone!,
      patientId: activeOne.id,
      doctorId: fixture.doctorOne.id,
      departmentId: fixture.department.id,
      timeSlotId: fixture.slotOne.id,
      estimatedPrice: 300000,
      finalAmount: 300000,
    },
  });

  const segmented = await http.request("/api/dashboard/notifications", {
    method: "POST",
    headers: dashboardHeaders(adminCookie),
    body: {
      title: "Nhắc chuẩn bị trước khám",
      body: "Vui lòng kiểm tra giấy tờ cần mang theo trước khi đến viện.",
      audience: "DEPARTMENT_APPOINTMENTS",
      departmentId: fixture.department.id,
    },
  });
  assert.equal(segmented.status, 201);
  assert.equal(segmented.body.data.recipientCount, 1);
  assert.equal(segmented.body.data.audience, "DEPARTMENT_APPOINTMENTS");
  assert.equal(segmented.body.data.department.id, fixture.department.id);
  const segmentedRecipients = await prisma.notification.findMany({
    where: { campaignId: segmented.body.data.campaignId },
    select: { userId: true, payload: true },
  });
  assert.deepEqual(segmentedRecipients.map((item) => item.userId), [activeOne.id]);

  const invalidExpiry = await http.request("/api/dashboard/notifications", {
    method: "POST",
    headers: dashboardHeaders(adminCookie),
    body: {
      title: "Thông báo hết hạn sai",
      body: "Nội dung dùng để kiểm tra ràng buộc thời gian.",
      scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    },
  });
  assert.equal(invalidExpiry.status, 400);

  const expiredNotification = await prisma.notification.create({
    data: {
      userId: activeTwo.id,
      type: "SYSTEM_ANNOUNCEMENT",
      title: "Thông báo đã hết hạn",
      body: "Bản ghi dùng để kiểm tra chính sách lưu trữ.",
      publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  });
  const cleanup = await NotificationService.cleanupExpiredAndRead(180);
  assert.equal(cleanup.deletedCount, 1);
  assert.equal(
    await prisma.notification.count({ where: { id: expiredNotification.id } }),
    0,
  );

  const doctorForbidden = await http.request("/api/dashboard/notifications", {
    headers: dashboardHeaders(
      await authCookie(fixture.doctorOneUser.id, "DOCTOR"),
    ),
  });
  assert.equal(doctorForbidden.status, 403);
});

test("patient journey is consistent across public booking dashboard care and mobile reads", async () => {
  const phone = "0985656565";
  const dashboardCookie = await authCookie(fixture.adminUser.id, "ADMIN");
  const doctorCookie = await authCookie(fixture.doctorOneUser.id, "DOCTOR");

  const booking = await http.request("/api/v1/appointments", {
    method: "POST",
    body: bookingBody({ phone, timeSlotId: fixture.slotOne.id }),
  });
  assert.equal(booking.status, 201);
  const originalAppointmentId = booking.body.data.appointmentId as string;

  const verifiedBooking = await http.request(
    `/api/v1/appointments/${originalAppointmentId}/verify-otp`,
    {
      method: "POST",
      body: { otp: booking.body.data.debugOtp },
    },
  );
  assert.equal(verifiedBooking.status, 200);
  assert.equal(verifiedBooking.body.data.status, "PENDING_CONFIRM");

  const patient = await loginPatient(phone);
  const patientHeaders = {
    authorization: `Bearer ${patient.accessToken}`,
  };

  const confirmed = await http.request(
    `/api/dashboard/appointments/${originalAppointmentId}/confirm`,
    { method: "PATCH", headers: dashboardHeaders(dashboardCookie) },
  );
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.data.status, "CONFIRMED");

  const rescheduled = await http.request(
    `/api/dashboard/appointments/${originalAppointmentId}/reschedule`,
    {
      method: "PATCH",
      headers: dashboardHeaders(dashboardCookie),
      body: {
        timeSlotId: fixture.slotTwo.id,
        reason: "Điều chỉnh lịch trong kiểm thử E2E",
      },
    },
  );
  assert.equal(rescheduled.status, 200);
  assert.equal(rescheduled.body.data.status, "CONFIRMED");
  const activeAppointmentId = rescheduled.body.data.id as string;

  for (const [action, expectedStatus] of [
    ["check-in", "CHECKED_IN"],
    ["start", "IN_PROGRESS"],
  ] as const) {
    const transition = await http.request(
      `/api/dashboard/appointments/${activeAppointmentId}/${action}`,
      {
        method: "PATCH",
        headers: dashboardHeaders(
          action === "start"
            ? await authCookie(fixture.doctorOneUser.id, "DOCTOR")
            : dashboardCookie,
        ),
      },
    );
    assert.equal(transition.status, 200, action);
    assert.equal(transition.body.data.status, expectedStatus, action);
  }

  const record = await prisma.medicalRecord.findUniqueOrThrow({
    where: { appointmentId: activeAppointmentId },
    select: { id: true },
  });
  const updatedRecord = await http.request(
    `/api/dashboard/medical-records/${record.id}`,
    {
      method: "PATCH",
      headers: dashboardHeaders(doctorCookie),
      body: {
        symptoms: "Đau đầu nhẹ",
        diagnosis: "Theo dõi đau đầu căng thẳng",
        treatment: "Nghỉ ngơi và dùng thuốc theo đơn",
        doctorNotes: "Tái khám nếu triệu chứng tăng",
      },
    },
  );
  assert.equal(updatedRecord.status, 200);

  const createdPrescription = await http.request(
    `/api/dashboard/medical-records/${record.id}/prescription`,
    {
      method: "POST",
      headers: dashboardHeaders(doctorCookie),
      body: {
        note: "Dùng thuốc sau ăn",
        items: [
          {
            medicineName: "Paracetamol 500mg",
            dosage: "1 viên",
            frequency: "Khi đau",
            duration: "3 ngày",
            quantity: 6,
            unit: "viên",
            instruction: "Không quá 4 viên mỗi ngày",
          },
        ],
      },
    },
  );
  assert.equal(createdPrescription.status, 201);
  const prescriptionId = createdPrescription.body.data.id as string;

  const issuedPrescription = await http.request(
    `/api/dashboard/prescriptions/${prescriptionId}/issue`,
    { method: "PATCH", headers: dashboardHeaders(doctorCookie) },
  );
  assert.equal(issuedPrescription.status, 200);
  assert.equal(issuedPrescription.body.data.status, "ISSUED");

  const completed = await http.request(
    `/api/dashboard/appointments/${activeAppointmentId}/complete`,
    { method: "PATCH", headers: dashboardHeaders(doctorCookie) },
  );
  assert.equal(completed.status, 200);
  assert.equal(completed.body.data.status, "COMPLETED");

  const publishedRecord = await http.request(
    `/api/dashboard/medical-records/${record.id}/publish`,
    { method: "PATCH", headers: dashboardHeaders(doctorCookie) },
  );
  assert.equal(publishedRecord.status, 200);
  assert.equal(publishedRecord.body.data.status, "PUBLISHED");

  // Mỗi thao tác lâm sàng để lại dấu vết ai-làm-gì, không chứa nội dung y tế.
  const clinicalLogs = await prisma.appointmentLog.findMany({
    where: {
      appointmentId: activeAppointmentId,
      action: {
        in: ["MEDICAL_RESULT_UPDATED", "PRESCRIPTION_ISSUED", "MEDICAL_RESULT_PUBLISHED"],
      },
    },
    select: { action: true, createdById: true, note: true },
  });
  assert.deepEqual(
    clinicalLogs.map((item) => item.action).sort(),
    ["MEDICAL_RESULT_PUBLISHED", "MEDICAL_RESULT_UPDATED", "PRESCRIPTION_ISSUED"],
  );
  assert.ok(clinicalLogs.every((item) => item.createdById === fixture.doctorOneUser.id));
  assert.ok(
    clinicalLogs.every((item) => !/Đau đầu|Paracetamol|Theo dõi đau đầu/.test(item.note || "")),
  );

  const createdInvoice = await http.request(
    `/api/dashboard/invoices/appointments/${activeAppointmentId}`,
    {
      method: "POST",
      headers: dashboardHeaders(dashboardCookie),
      body: {},
    },
  );
  assert.equal(createdInvoice.status, 201);
  const invoiceId = createdInvoice.body.data.id as string;

  const paidInvoice = await http.request(
    `/api/dashboard/invoices/${invoiceId}/pay`,
    {
      method: "PATCH",
      headers: dashboardHeaders(dashboardCookie),
      body: { paymentMethod: "CASH" },
    },
  );
  assert.equal(paidInvoice.status, 200);
  assert.equal(paidInvoice.body.data.status, "PAID");

  const [appointments, records, prescriptions, invoices, notifications] =
    await Promise.all([
      http.request("/api/v1/me/appointments?limit=20", {
        headers: patientHeaders,
      }),
      http.request("/api/v1/me/medical-records?limit=20", {
        headers: patientHeaders,
      }),
      http.request("/api/v1/me/prescriptions?limit=20", {
        headers: patientHeaders,
      }),
      http.request("/api/v1/me/invoices?limit=20", {
        headers: patientHeaders,
      }),
      http.request("/api/v1/me/notifications?limit=50", {
        headers: patientHeaders,
      }),
    ]);

  assert.ok(
    appointments.body.data.some(
      (item: { id: string; status: string }) =>
        item.id === activeAppointmentId && item.status === "COMPLETED",
    ),
  );
  assert.ok(
    records.body.data.some(
      (item: { id: string; status: string }) =>
        item.id === record.id && item.status === "PUBLISHED",
    ),
  );
  assert.ok(
    prescriptions.body.data.some(
      (item: { id: string; status: string }) =>
        item.id === prescriptionId && item.status === "ISSUED",
    ),
  );
  assert.ok(
    invoices.body.data.some(
      (item: { id: string; status: string }) =>
        item.id === invoiceId && item.status === "PAID",
    ),
  );

  const notificationTypes = new Set(
    notifications.body.data.map((item: { type: string }) => item.type),
  );
  assert.deepEqual(
    notificationTypes,
    new Set([
      "APPOINTMENT_CONFIRMED",
      "APPOINTMENT_RESCHEDULED",
      "APPOINTMENT_CHECKED_IN",
      "APPOINTMENT_IN_PROGRESS",
      "APPOINTMENT_COMPLETED",
      "MEDICAL_RESULT_PUBLISHED",
      "PRESCRIPTION_ISSUED",
      "INVOICE_CREATED",
      "PAYMENT_SUCCEEDED",
    ]),
  );
  assert.equal(notifications.body.meta.unreadCount, 9);
});

test("patient push token follows the active session and is cleared safely", async () => {
  const first = await loginPatient("0984545454");
  const secondSession = await AuthSessionService.create({
    userId: first.user.id,
    kind: "PATIENT",
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    meta: {
      deviceId: "phase3-second-device",
      deviceName: "Phase 3 second device",
      platform: "android",
    },
  });
  const secondAccessToken = generatePatientAccessToken(
    { userId: first.user.id, sessionId: secondSession.session.id },
    "15m",
  );
  const pushToken = "phase3-fcm-installation-token-0001";
  const scheduled = await NotificationService.create({
    userId: first.user.id,
    type: "APPOINTMENT_REMINDER",
    title: "Nhắc lịch đăng ký muộn",
    body: "Thiết bị đăng ký sau vẫn phải nhận được lời nhắc tương lai.",
    entityType: "APPOINTMENT",
    entityId: "late-device-reminder-appointment",
    dedupeKey: "appointment:late-device-reminder-appointment:reminder",
    scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
    publishedAt: null,
  });
  assert.equal(
    await prisma.notificationDelivery.count({
      where: { notificationId: scheduled.id },
    }),
    0,
  );

  const firstRegistration = await http.request("/api/v1/auth/push-token", {
    method: "PUT",
    headers: { authorization: `Bearer ${first.accessToken}` },
    body: { pushToken, platform: "android", appVersion: "1.0.0" },
  });
  assert.equal(firstRegistration.status, 200);
  assert.equal(firstRegistration.body.data.enabled, true);
  const firstTokenSession = await prisma.dashboardSession.findFirstOrThrow({
    where: { userId: first.user.id, pushToken },
    select: { id: true },
  });
  assert.equal(
    await prisma.notificationDelivery.count({
      where: {
        notificationId: scheduled.id,
        sessionId: firstTokenSession.id,
      },
    }),
    1,
  );

  const secondRegistration = await http.request("/api/v1/auth/push-token", {
    method: "PUT",
    headers: { authorization: `Bearer ${secondAccessToken}` },
    body: { pushToken, platform: "android", appVersion: "1.0.0" },
  });
  assert.equal(secondRegistration.status, 200);

  const tokenOwners = await prisma.dashboardSession.findMany({
    where: { userId: first.user.id, pushToken },
    select: { id: true, pushDisabledAt: true },
  });
  assert.equal(tokenOwners.length, 1);
  assert.equal(tokenOwners[0]?.pushDisabledAt, null);

  const disabled = await http.request("/api/v1/auth/push-token", {
    method: "DELETE",
    headers: { authorization: `Bearer ${secondAccessToken}` },
  });
  assert.equal(disabled.status, 200);
  assert.equal(disabled.body.data.enabled, false);
  assert.equal(
    await prisma.dashboardSession.count({ where: { pushToken } }),
    0,
  );

  const reRegistered = await http.request("/api/v1/auth/push-token", {
    method: "PUT",
    headers: { authorization: `Bearer ${first.accessToken}` },
    body: { pushToken, platform: "android" },
  });
  assert.equal(reRegistered.status, 200);

  const loggedOut = await http.request("/api/v1/auth/logout", {
    method: "POST",
    body: { refreshToken: first.refreshToken },
  });
  assert.equal(loggedOut.status, 200);
  assert.equal(
    await prisma.dashboardSession.count({ where: { pushToken } }),
    0,
  );
});

test("slot reconciliation repairs only deterministic inconsistencies", async () => {
  await prisma.doctorTimeSlot.update({
    where: { id: fixture.slotOne.id },
    data: { status: "BOOKED" },
  });
  const patient = await prisma.user.create({
    data: {
      fullName: "Reconciliation Patient",
      phone: "0985555555",
      role: "PATIENT",
      isPhoneVerified: true,
    },
  });
  const appointment = await prisma.appointment.create({
    data: {
      bookingCode: "PHASE1-RECONCILE",
      appointmentDate: dateOnly(fixture.appointmentDate),
      startTime: fixture.slotTwo.startTime,
      endTime: fixture.slotTwo.endTime,
      status: "CONFIRMED",
      patientName: patient.fullName,
      patientPhone: patient.phone!,
      patientId: patient.id,
      doctorId: fixture.doctorOne.id,
      departmentId: fixture.department.id,
      timeSlotId: fixture.slotTwo.id,
    },
  });

  const result = await ScheduleReconciliationService.reconcile();
  assert.equal(result.findingCount, 2);
  assert.equal(result.repairedCount, 2);

  const [orphan, linked] = await Promise.all([
    prisma.doctorTimeSlot.findUniqueOrThrow({ where: { id: fixture.slotOne.id } }),
    prisma.doctorTimeSlot.findUniqueOrThrow({ where: { id: fixture.slotTwo.id } }),
  ]);
  assert.equal(orphan.status, "AVAILABLE");
  assert.equal(linked.status, "BOOKED");
  assert.equal(
    (await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } })).timeSlotId,
    fixture.slotTwo.id,
  );
});

test("v1 capabilities reflect the payment providers enabled by configuration", async () => {
  const response = await http.request("/api/v1/capabilities");
  assert.equal(response.status, 200);
  assert.equal(response.body.data.payment.enabled, true);
  assert.equal(response.body.data.payment.reason, null);
  assert.deepEqual(response.body.data.payment.supportedProviders, ["VNPAY"]);
  assert.equal(response.body.data.notifications.inAppInbox, true);
  const expectedPushEnabled = isFirebaseAdminConfigured();
  assert.equal(
    response.body.data.notifications.pushDelivery,
    expectedPushEnabled,
  );
  assert.equal(
    response.body.data.pushNotifications.enabled,
    expectedPushEnabled,
  );
});

test("patient notification inbox is private, filterable and idempotent", async () => {
  const auth = await loginPatient("0986666666");
  const otherAuth = await loginPatient("0987777777");
  const authorization = `Bearer ${auth.accessToken}`;
  const now = Date.now();

  const first = await NotificationService.create({
    userId: auth.user.id,
    type: "APPOINTMENT_CONFIRMED",
    title: "Lịch khám đã được xác nhận",
    body: "Bạn có cập nhật mới về lịch khám.",
    entityType: "APPOINTMENT",
    entityId: "appointment-one",
    dedupeKey: `appointment-one:confirmed:${auth.user.id}`,
    publishedAt: new Date(now - 2 * 60_000),
  });
  const duplicate = await NotificationService.create({
    userId: auth.user.id,
    type: "APPOINTMENT_CONFIRMED",
    title: "Nội dung không được ghi đè",
    body: "Thông báo trùng phải được bỏ qua.",
    entityType: "APPOINTMENT",
    entityId: "appointment-one",
    dedupeKey: `appointment-one:confirmed:${auth.user.id}`,
  });
  assert.equal(duplicate.id, first.id);
  assert.equal(duplicate.title, first.title);

  const latest = await NotificationService.create({
    userId: auth.user.id,
    type: "APPOINTMENT_RESCHEDULED",
    title: "Lịch khám đã được đổi giờ",
    body: "Bạn có cập nhật mới về lịch khám.",
    entityType: "APPOINTMENT",
    entityId: "appointment-two",
    publishedAt: new Date(now - 60_000),
  });
  const alreadyRead = await NotificationService.create({
    userId: auth.user.id,
    type: "APPOINTMENT_REMINDER",
    title: "Nhắc lịch khám",
    body: "Bạn có lịch khám sắp tới.",
    entityType: "APPOINTMENT",
    entityId: "appointment-three",
    publishedAt: new Date(now - 3 * 60_000),
  });
  await prisma.notification.update({
    where: { id: alreadyRead.id },
    data: { readAt: new Date(now - 30_000) },
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: auth.user.id,
        type: "APPOINTMENT_REMINDER",
        title: "Chưa đến giờ công bố",
        body: "Không được xuất hiện sớm.",
        publishedAt: null,
        scheduledAt: new Date(now + 60_000),
      },
      {
        userId: auth.user.id,
        type: "APPOINTMENT_REMINDER",
        title: "Đã hết hạn",
        body: "Không được xuất hiện sau khi hết hạn.",
        publishedAt: new Date(now - 120_000),
        expiresAt: new Date(now - 60_000),
      },
      {
        userId: auth.user.id,
        type: "APPOINTMENT_CANCELLED",
        title: "Đã hủy trước khi công bố",
        body: "Không được xuất hiện khi đã hủy.",
        publishedAt: new Date(now - 120_000),
        cancelledAt: new Date(now - 60_000),
      },
      {
        userId: otherAuth.user.id,
        type: "APPOINTMENT_CONFIRMED",
        title: "Thông báo của người khác",
        body: "Không được lộ sang tài khoản khác.",
        publishedAt: new Date(now - 30_000),
      },
    ],
  });

  const firstPage = await http.request(
    "/api/v1/me/notifications?page=1&limit=2",
    { headers: { authorization } },
  );
  assert.equal(firstPage.status, 200);
  assert.equal(firstPage.body.data.length, 2);
  assert.equal(firstPage.body.data[0].id, latest.id);
  assert.equal(firstPage.body.data[1].id, first.id);
  assert.equal(firstPage.body.data[0].isRead, false);
  assert.equal(firstPage.body.meta.total, 3);
  assert.equal(firstPage.body.meta.unreadCount, 2);
  assert.equal(firstPage.body.meta.hasNextPage, true);

  const unread = await http.request(
    "/api/v1/me/notifications?unread=true",
    { headers: { authorization } },
  );
  assert.equal(unread.status, 200);
  assert.equal(unread.body.meta.total, 2);
  assert.equal(unread.body.meta.unreadCount, 2);

  const unreadCount = await http.request(
    "/api/v1/me/notifications/unread-count",
    { headers: { authorization } },
  );
  assert.equal(unreadCount.status, 200);
  assert.equal(unreadCount.body.data.unreadCount, 2);

  const marked = await http.request(
    `/api/v1/me/notifications/${first.id}/read`,
    { method: "PATCH", headers: { authorization } },
  );
  assert.equal(marked.status, 200);
  assert.equal(marked.body.data.isRead, true);

  const crossPatient = await http.request(
    `/api/v1/me/notifications/${(
      await prisma.notification.findFirstOrThrow({
        where: { userId: otherAuth.user.id },
        select: { id: true },
      })
    ).id}/read`,
    { method: "PATCH", headers: { authorization } },
  );
  assert.equal(crossPatient.status, 404);
  assert.equal(crossPatient.body.code, "NOTIFICATION_NOT_FOUND");

  const markAll = await http.request(
    "/api/v1/me/notifications/read-all",
    { method: "PATCH", headers: { authorization } },
  );
  assert.equal(markAll.status, 200);
  assert.equal(markAll.body.data.updatedCount, 1);
  assert.equal(markAll.body.data.unreadCount, 0);

  const invalidFilter = await http.request(
    "/api/v1/me/notifications?unread=yes",
    { headers: { authorization } },
  );
  assert.equal(invalidFilter.status, 400);
  assert.equal(invalidFilter.body.code, "VALIDATION_ERROR");

  const defaultPreferences = await http.request(
    "/api/v1/me/notifications/preferences",
    { headers: { authorization } },
  );
  assert.equal(defaultPreferences.status, 200);
  assert.deepEqual(defaultPreferences.body.data, {
    appointmentUpdatesPush: true,
    appointmentRemindersPush: true,
    medicalResultsPush: true,
    prescriptionsPush: true,
    billingPush: true,
    generalAnnouncementsPush: true,
  });

  const updatedPreferences = await http.request(
    "/api/v1/me/notifications/preferences",
    {
      method: "PATCH",
      headers: { authorization },
      body: {
        appointmentRemindersPush: false,
        billingPush: false,
        generalAnnouncementsPush: false,
      },
    },
  );
  assert.equal(updatedPreferences.status, 200);
  assert.equal(
    updatedPreferences.body.data.appointmentRemindersPush,
    false,
  );
  assert.equal(updatedPreferences.body.data.billingPush, false);
  assert.equal(updatedPreferences.body.data.generalAnnouncementsPush, false);
  assert.equal(updatedPreferences.body.data.medicalResultsPush, true);

  const invalidPreferences = await http.request(
    "/api/v1/me/notifications/preferences",
    {
      method: "PATCH",
      headers: { authorization },
      body: { unsupportedPush: false },
    },
  );
  assert.equal(invalidPreferences.status, 400);
  assert.equal(invalidPreferences.body.code, "VALIDATION_ERROR");

  const unauthenticated = await http.request("/api/v1/me/notifications");
  assert.equal(unauthenticated.status, 401);
});

test("patient profile health data needs explicit consent that is recorded once", async () => {
  const patient = await prisma.user.create({
    data: {
      fullName: "Health Consent Patient",
      phone: "0983333330",
      role: "PATIENT",
      isPhoneVerified: true,
      patientProfile: { create: {} },
    },
  });
  const auth = await loginPatient(patient.phone!);
  const authorization = `Bearer ${auth.accessToken}`;
  const patch = (body: Record<string, unknown>) =>
    http.request("/api/v1/me", { method: "PATCH", headers: { authorization }, body });

  const denied = await patch({ allergies: "Penicillin" });
  assert.equal(denied.status, 400);
  assert.equal(denied.body.code, "HEALTH_CONSENT_REQUIRED");

  const plain = await patch({ address: "12 Nguyen Hue" });
  assert.equal(plain.status, 200);
  assert.equal(plain.body.data.patientProfile.allergies, null);
  assert.equal(plain.body.data.patientProfile.healthConsentAt, null);

  const consented = await patch({ allergies: "Penicillin", healthConsent: true });
  assert.equal(consented.status, 200);
  assert.equal(consented.body.data.patientProfile.allergies, "Penicillin");
  assert.equal(consented.body.data.patientProfile.healthConsentVersion, "2026-11");
  assert.ok(consented.body.data.patientProfile.healthConsentAt);

  // Đã có bản ghi đồng ý đúng phiên bản: sửa tiếp không bị hỏi lại.
  const later = await patch({ medicalHistory: "Hen suyen" });
  assert.equal(later.status, 200);
  assert.equal(later.body.data.patientProfile.medicalHistory, "Hen suyen");

  // Xóa nội dung không cần đồng ý.
  const cleared = await patch({ allergies: null, medicalHistory: "" });
  assert.equal(cleared.status, 200);
  assert.equal(cleared.body.data.patientProfile.allergies, null);
});

test("patient profile resend of unchanged legacy health data does not need consent", async () => {
  const patient = await prisma.user.create({
    data: {
      fullName: "Legacy Health Patient",
      phone: "0983333331",
      role: "PATIENT",
      isPhoneVerified: true,
      patientProfile: { create: { allergies: "Penicillin", medicalHistory: "Hen suyen" } },
    },
  });
  const auth = await loginPatient(patient.phone!);
  const authorization = `Bearer ${auth.accessToken}`;
  const patch = (body: Record<string, unknown>) =>
    http.request("/api/v1/me", { method: "PATCH", headers: { authorization }, body });

  // App cũ gửi lại cả hồ sơ: dữ liệu sức khỏe giữ nguyên nên không bị chặn.
  const resent = await patch({
    address: "34 Le Loi",
    allergies: " Penicillin ",
    medicalHistory: "Hen suyen",
    familyHistory: null,
  });
  assert.equal(resent.status, 200);
  assert.equal(resent.body.data.patientProfile.address, "34 Le Loi");
  assert.equal(resent.body.data.patientProfile.healthConsentAt, null);

  // Nội dung đổi hoặc thêm mới thì cần đồng ý.
  const changed = await patch({ allergies: "Penicillin, Aspirin" });
  assert.equal(changed.status, 400);
  assert.equal(changed.body.code, "HEALTH_CONSENT_REQUIRED");
  const added = await patch({ familyHistory: "Tieu duong" });
  assert.equal(added.status, 400);

  const consented = await patch({ allergies: "Penicillin, Aspirin", healthConsent: true });
  assert.equal(consented.status, 200);
  assert.equal(consented.body.data.patientProfile.healthConsentVersion, "2026-11");
});

// ---- Đối soát VNPAY bằng querydr -----------------------------------------
const withStubbedVnpayQuery = async (
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

test("querydr reconciliation settles a payment whose Return URL and IPN were both lost", async () => {
  const { default: PaymentService } = await import("../../src/services/payment.service.js");
  const { invoice, authorization, appointment } = await createPayableInvoice({
    bookingCode: "VNPAY-QUERYDR-PAID",
  });
  const payment = await createVnpayPayment(invoice.id, authorization, "vnpay-querydr-paid");
  // Giao dịch đã treo đủ lâu để quét định kỳ chú ý tới.
  await prisma.paymentTransaction.update({
    where: { id: payment.id },
    data: { createdAt: new Date(Date.now() - 10 * 60 * 1000) },
  });

  await withStubbedVnpayQuery(
    (txnRef) => buildVnpayQueryResponse({ transactionCode: txnRef, amount: 300000 }),
    async () => {
      const summary = await PaymentService.reconcilePendingVnpay();
      assert.equal(summary.scanned, 1);
      assert.equal(summary.paid, 1);
      assert.equal(summary.errors, 0);
      // Quét lại: giao dịch đã SUCCESS nên không còn ứng viên và không ghi nhận lần hai.
      assert.equal((await PaymentService.reconcilePendingVnpay()).scanned, 0);
    },
  );

  const paid = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
  assert.equal(paid.status, "PAID");
  assert.equal(paid.paymentMethod, "VNPAY");
  assert.equal(paid.paymentReference, "15000001");
  assert.equal(
    (await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: payment.id } })).status,
    "SUCCESS",
  );
  assert.equal(
    await prisma.appointmentLog.count({
      where: { appointmentId: appointment.id, action: "PAYMENT_RECORDED" },
    }),
    1,
  );
  assert.equal(
    await prisma.notification.count({
      where: { userId: appointment.patientId, type: "PAYMENT_SUCCEEDED" },
    }),
    1,
  );
});

test("querydr reconciliation keeps young pending payments, expires abandoned ones and records failures", async () => {
  const { default: PaymentService } = await import("../../src/services/payment.service.js");
  const { invoice, authorization } = await createPayableInvoice({
    bookingCode: "VNPAY-QUERYDR-PENDING",
  });
  const payment = await createVnpayPayment(invoice.id, authorization, "vnpay-querydr-pending");

  // Khách chưa hoàn tất (mã giao dịch 01): còn hạn thì giữ PENDING.
  await withStubbedVnpayQuery(
    (txnRef) => buildVnpayQueryResponse({ transactionCode: txnRef, amount: 300000, transactionStatus: "01" }),
    async () => {
      assert.equal((await PaymentService.reconcileVnpayTransaction(payment.id)).outcome, "PENDING");
    },
  );
  assert.equal(
    (await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: payment.id } })).status,
    "PENDING",
  );

  // Quá hạn thanh toán mà VNPAY không có giao dịch (mã 91): chuyển EXPIRED, hóa đơn vẫn UNPAID.
  await withStubbedVnpayQuery(
    (txnRef) =>
      buildVnpayQueryResponse({ transactionCode: txnRef, amount: 300000, responseCode: "91" }),
    async () => {
      const later = new Date(Date.now() + 60 * 60 * 1000);
      assert.equal(
        (await PaymentService.reconcileVnpayTransaction(payment.id, later)).outcome,
        "EXPIRED",
      );
    },
  );
  assert.equal(
    (await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: payment.id } })).status,
    "EXPIRED",
  );
  assert.equal(
    (await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status,
    "UNPAID",
  );

  // Giao dịch mới trên cùng hóa đơn bị VNPAY báo lỗi (mã 02): ghi nhận FAILED, hóa đơn còn UNPAID.
  const second = await createVnpayPayment(invoice.id, authorization, "vnpay-querydr-failed");
  await withStubbedVnpayQuery(
    (txnRef) => buildVnpayQueryResponse({ transactionCode: txnRef, amount: 300000, transactionStatus: "02" }),
    async () => {
      assert.equal((await PaymentService.reconcileVnpayTransaction(second.id)).outcome, "FAILED");
    },
  );
  assert.equal(
    (await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: second.id } })).status,
    "FAILED",
  );
  assert.equal(
    (await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status,
    "UNPAID",
  );
});

test("querydr reconciliation refuses a mismatched amount, a forged response and a VNPAY outage", async () => {
  const { default: PaymentService } = await import("../../src/services/payment.service.js");
  const { invoice, authorization } = await createPayableInvoice({
    bookingCode: "VNPAY-QUERYDR-GUARD",
  });
  const payment = await createVnpayPayment(invoice.id, authorization, "vnpay-querydr-guard");

  await withStubbedVnpayQuery(
    (txnRef) => buildVnpayQueryResponse({ transactionCode: txnRef, amount: 100000 }),
    async () => {
      await assert.rejects(
        PaymentService.reconcileVnpayTransaction(payment.id),
        /Số tiền VNPAY không khớp hóa đơn/,
      );
    },
  );
  await withStubbedVnpayQuery(
    (txnRef) =>
      buildVnpayQueryResponse({
        transactionCode: txnRef,
        amount: 300000,
        secret: "WRONGSECRETWRONGSECRETWRONGSEC12",
      }),
    async () => {
      await assert.rejects(
        PaymentService.reconcileVnpayTransaction(payment.id),
        /Chữ ký phản hồi truy vấn VNPAY không hợp lệ/,
      );
    },
  );

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;
  try {
    await assert.rejects(
      PaymentService.reconcileVnpayTransaction(payment.id),
      /Không kết nối được VNPAY/,
    );
    // Lượt xem của người dùng không bị hỏng khi VNPAY gián đoạn.
    await prisma.paymentTransaction.update({
      where: { id: payment.id },
      data: { createdAt: new Date(Date.now() - 10 * 60 * 1000) },
    });
    const viewed = await PaymentService.getByIdWithReconciliation(
      payment.id,
      (await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).patientId,
    );
    assert.equal(viewed.status, "PENDING");
  } finally {
    globalThis.fetch = originalFetch;
  }

  const untouched = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
  assert.equal(untouched.status, "UNPAID");
  assert.equal(
    (await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: payment.id } })).status,
    "PENDING",
  );
});

// ---- Hoàn tiền VNPAY qua API ----------------------------------------------
const withStubbedVnpayRefund = async (
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

const createVnpayPaidInvoice = async (bookingCode: string) => {
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

const callVnpayRefund = (invoiceId: string, cookie: string, refundReason = "Benh nhan huy dich vu") =>
  http.request(`/api/dashboard/invoices/${invoiceId}/refund/vnpay`, {
    method: "POST",
    headers: dashboardHeaders(cookie),
    body: { refundReason },
  });

test("VNPay refund API refunds a VNPAY-paid invoice once and records it", async () => {
  const { invoice, payment, appointment } = await createVnpayPaidInvoice("VNPAY-REFUND-OK");
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");

  let sent: Record<string, unknown> | undefined;
  await withStubbedVnpayRefund(
    (body) => {
      sent = body;
      return buildVnpayRefundResponse({ transactionCode: String(body.vnp_TxnRef), amount: 300000 });
    },
    async () => {
      const refunded = await callVnpayRefund(invoice.id, adminCookie);
      assert.equal(refunded.status, 200, JSON.stringify(refunded.body));
      assert.equal(refunded.body.data.status, "REFUNDED");
      // Gửi đúng giao dịch gốc: mã VNPAY của lần trả tiền và đúng số tiền.
      assert.equal(sent?.vnp_TxnRef, payment.transactionCode);
      assert.equal(sent?.vnp_TransactionNo, "14000001");
      assert.equal(sent?.vnp_Amount, 30000000);
      assert.equal(sent?.vnp_TransactionType, "02");

      // Gọi lần hai không gửi thêm yêu cầu hoàn nào.
      sent = undefined;
      assert.equal((await callVnpayRefund(invoice.id, adminCookie)).status, 409);
      assert.equal(sent, undefined);
    },
  );

  const stored = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
  assert.equal(stored.status, "REFUNDED");
  assert.equal(stored.refundReference, "16000001");
  assert.ok(stored.refundRequestId);
  assert.equal(
    await prisma.appointmentLog.count({
      where: { appointmentId: appointment.id, action: "PAYMENT_REFUNDED" },
    }),
    1,
  );
  assert.equal(
    await prisma.notification.count({
      where: { userId: appointment.patientId, type: "PAYMENT_REFUNDED" },
    }),
    1,
  );
});

test("VNPay refund API frees the invoice after a definite rejection", async () => {
  const { invoice } = await createVnpayPaidInvoice("VNPAY-REFUND-REJECT");
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");

  await withStubbedVnpayRefund(
    (body) =>
      buildVnpayRefundResponse({
        transactionCode: String(body.vnp_TxnRef),
        amount: 300000,
        responseCode: "95",
      }),
    async () => {
      const rejected = await callVnpayRefund(invoice.id, adminCookie);
      assert.equal(rejected.status, 422);
      assert.equal(rejected.body.code, "VNPAY_REFUND_REJECTED");
    },
  );
  const afterReject = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
  assert.equal(afterReject.status, "PAID");
  assert.equal(afterReject.refundRequestId, null);

  // Bị từ chối rõ ràng nên thử lại được.
  await withStubbedVnpayRefund(
    (body) => buildVnpayRefundResponse({ transactionCode: String(body.vnp_TxnRef), amount: 300000 }),
    async () => assert.equal((await callVnpayRefund(invoice.id, adminCookie)).status, 200),
  );
  assert.equal(
    (await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status,
    "REFUNDED",
  );
});

test("VNPay refund API never retries an unverifiable result and allows manual confirmation", async () => {
  const { invoice } = await createVnpayPaidInvoice("VNPAY-REFUND-UNKNOWN");
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");

  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (!String(url).includes("merchant_webapi")) return originalFetch(url, init);
    calls += 1;
    throw new Error("network down");
  }) as unknown as typeof fetch;
  try {
    const first = await callVnpayRefund(invoice.id, adminCookie);
    assert.equal(first.status, 502);
    assert.equal(first.body.code, "VNPAY_REFUND_UNVERIFIED");
    assert.equal(calls, 1);

    // Tiền có thể đã được hoàn: không gửi thêm yêu cầu nào nữa.
    const second = await callVnpayRefund(invoice.id, adminCookie);
    assert.equal(second.status, 409);
    assert.equal(second.body.code, "REFUND_PENDING_VERIFICATION");
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }

  const pending = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
  assert.equal(pending.status, "PAID");
  assert.ok(pending.refundRequestId);

  // Sau khi kiểm tra trên cổng VNPAY, quản trị ghi nhận thủ công như trước.
  const manual = await http.request(`/api/dashboard/invoices/${invoice.id}/refund`, {
    method: "PATCH",
    headers: dashboardHeaders(adminCookie),
    body: { refundReason: "Da xac nhan tren cong VNPAY", refundReference: "VNP-MANUAL-1" },
  });
  assert.equal(manual.status, 200);
  assert.equal(manual.body.data.status, "REFUNDED");
});

test("VNPay refund API refuses non-VNPAY invoices and users without invoice.refund", async () => {
  const cash = await createPayableInvoice({ bookingCode: "VNPAY-REFUND-CASH" });
  await InvoiceService.pay(cash.invoice.id, { paymentMethod: "CASH" }, fixture.adminUser.id);
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");
  const staff = await createDashboardUser("STAFF", "0900000099");
  const staffCookie = await authCookie(staff.id, "STAFF");

  assert.equal((await callVnpayRefund(cash.invoice.id, adminCookie)).status, 409);
  assert.equal((await callVnpayRefund(cash.invoice.id, staffCookie)).status, 403);
  assert.equal((await callVnpayRefund(cash.invoice.id, adminCookie, "ab")).status, 400);
});

// ---- Nhật ký truy cập, buộc đổi mật khẩu, tách quyền nhạy cảm -----------------
const dashboardCall = (
  method: string,
  path: string,
  cookie: string,
  body?: unknown,
) => http.request(path, { method, headers: dashboardHeaders(cookie), body });

test("password reset by an admin forces a change, revokes sessions and is audited", async () => {
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");
  const target = await createDashboardUser("STAFF", "0900000101");
  const targetCookie = await authCookie(target.id, "STAFF");
  assert.equal((await dashboardCall("GET", "/api/dashboard/invoices", targetCookie)).status, 200);

  const reset = await dashboardCall(
    "PATCH",
    `/api/dashboard/users/${target.id}/password`,
    adminCookie,
    { password: "TempPass123" },
  );
  assert.equal(reset.status, 200);
  assert.equal(
    (await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).mustChangePassword,
    true,
  );
  // Phiên cũ của người bị đặt lại mật khẩu không còn dùng được.
  assert.equal((await dashboardCall("GET", "/api/dashboard/invoices", targetCookie)).status, 401);

  const audit = await prisma.auditLog.findFirstOrThrow({
    where: { action: "USER_PASSWORD_RESET", targetId: target.id },
  });
  assert.equal(audit.actorId, fixture.adminUser.id);
  assert.equal(audit.actorRole, "ADMIN");

  // Đăng nhập lại: chỉ đổi mật khẩu được cho tới khi tự đặt mật khẩu mới.
  const freshCookie = await authCookie(target.id, "STAFF");
  const blocked = await dashboardCall("GET", "/api/dashboard/invoices", freshCookie);
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.code, "PASSWORD_CHANGE_REQUIRED");
  const me = await dashboardCall("GET", "/api/auth/dashboard/me", freshCookie);
  assert.equal(me.status, 200);
  assert.equal(me.body.data.mustChangePassword, true);

  const wrongCurrent = await dashboardCall("POST", "/api/auth/dashboard/change-password", freshCookie, {
    currentPassword: "khong-dung",
    newPassword: "BrandNewPass1",
  });
  assert.equal(wrongCurrent.status, 400);
  const changed = await dashboardCall("POST", "/api/auth/dashboard/change-password", freshCookie, {
    currentPassword: "TempPass123",
    newPassword: "BrandNewPass1",
  });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  assert.equal((await dashboardCall("GET", "/api/dashboard/invoices", freshCookie)).status, 200);
  assert.equal(
    await prisma.auditLog.count({ where: { action: "PASSWORD_CHANGED", actorId: target.id } }),
    1,
  );
});

test("the audit log is append-only and only readable by users with audit.view", async () => {
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");
  const staff = await createDashboardUser("STAFF", "0900000102");
  const staffCookie = await authCookie(staff.id, "STAFF");
  await prisma.auditLog.create({ data: { action: "USER_UPDATED", actorId: fixture.adminUser.id } });

  const listed = await dashboardCall("GET", "/api/dashboard/audit-logs?limit=5", adminCookie);
  assert.equal(listed.status, 200);
  assert.ok(listed.body.data.items.length >= 1);
  assert.equal((await dashboardCall("GET", "/api/dashboard/audit-logs", staffCookie)).status, 403);

  const row = await prisma.auditLog.findFirstOrThrow();
  await assert.rejects(
    prisma.auditLog.update({ where: { id: row.id }, data: { action: "TAMPERED" } }),
    /chỉ thêm dòng/,
  );
  await assert.rejects(prisma.auditLog.delete({ where: { id: row.id } }), /chỉ thêm dòng/);
});

test("admin reads clinical data only after being granted, and every detail view is audited", async () => {
  const appointment = await createStoredAppointment({
    status: "COMPLETED",
    bookingCode: "AUDIT-VIEW",
  });
  const record = await prisma.medicalRecord.create({
    data: {
      recordCode: "AUDIT-VIEW-REC",
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      status: "DRAFT",
    },
  });
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");
  const doctorCookie = await authCookie(fixture.doctorOneUser.id, "DOCTOR");
  const detail = (cookie: string) =>
    dashboardCall("GET", `/api/dashboard/medical-records/${record.id}`, cookie);

  assert.equal((await detail(adminCookie)).status, 403);

  try {
    const granted = await dashboardCall("PUT", "/api/dashboard/rbac", adminCookie, {
      grants: { "record.view": ["ADMIN", "DOCTOR"] },
    });
    assert.equal(granted.status, 200, JSON.stringify(granted.body));
    const matrixAudit = await prisma.auditLog.findFirstOrThrow({
      where: { action: "RBAC_MATRIX_UPDATED" },
    });
    assert.deepEqual(
      Object.keys((matrixAudit.meta as { changes: Record<string, unknown> }).changes),
      ["record.view"],
    );

    assert.equal((await detail(adminCookie)).status, 200);
    const viewed = await prisma.auditLog.findMany({
      where: { action: "MEDICAL_RECORD_VIEWED", targetId: record.id },
    });
    assert.equal(viewed.length, 1);
    assert.equal(viewed[0].actorRole, "ADMIN");

    // Bác sĩ điều trị xem hồ sơ của mình là việc hằng ngày: không ghi.
    assert.equal((await detail(doctorCookie)).status, 200);
    assert.equal(
      await prisma.auditLog.count({ where: { action: "MEDICAL_RECORD_VIEWED" } }),
      1,
    );
  } finally {
    await RbacService.resetMatrix();
  }
});

test("only a doctor finishes an exam by default, and invoice adjustments are audited", async () => {
  const staff = await createDashboardUser("STAFF", "0900000103");
  const staffCookie = await authCookie(staff.id, "STAFF");
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");

  // Quyền được kiểm trước khi chạm vào lịch hẹn nên không cần dữ liệu thật.
  assert.equal(
    (await dashboardCall("PATCH", "/api/dashboard/appointments/any-id/complete", staffCookie, {})).status,
    403,
  );
  assert.notEqual(
    (await dashboardCall("PATCH", "/api/dashboard/appointments/any-id/start", staffCookie, {})).status,
    403,
  );

  const { invoice, appointment: adjustAppointment } = await createPayableInvoice({
    bookingCode: "AUDIT-ADJUST",
  });
  await prisma.appointment.update({
    where: { id: adjustAppointment.id },
    data: { hasBHYT: true },
  });
  const adjusted = await dashboardCall(
    "PATCH",
    `/api/dashboard/invoices/${invoice.id}`,
    staffCookie,
    { bhytDiscount: 50000 },
  );
  assert.equal(adjusted.status, 200, JSON.stringify(adjusted.body));
  const adjustAudit = await prisma.auditLog.findFirstOrThrow({
    where: { action: "INVOICE_ADJUSTED", targetId: invoice.id },
  });
  assert.equal(adjustAudit.actorId, staff.id);
  assert.deepEqual((adjustAudit.meta as { before: unknown }).before, {
    discount: 0,
    finalAmount: 300000,
  });
  assert.deepEqual((adjustAudit.meta as { after: unknown }).after, {
    discount: 50000,
    finalAmount: 250000,
  });

  // Hoàn tiền thủ công cũng để lại dấu vết (dùng lại hóa đơn trên sau khi thu tiền mặt).
  const paid = { invoice };
  await InvoiceService.pay(paid.invoice.id, { paymentMethod: "CASH" }, fixture.adminUser.id);
  const refunded = await dashboardCall(
    "PATCH",
    `/api/dashboard/invoices/${paid.invoice.id}/refund`,
    adminCookie,
    { refundReason: "Benh nhan huy dich vu" },
  );
  assert.equal(refunded.status, 200);
  const refundAudit = await prisma.auditLog.findFirstOrThrow({
    where: { action: "INVOICE_REFUNDED", targetId: paid.invoice.id },
  });
  assert.equal((refundAudit.meta as { via: string }).via, "MANUAL");
});

// ---- Rà phân quyền cổng bệnh nhân: không chạm được dữ liệu của người khác ----------
test("a patient cannot read or change another patient's data, nor unpublished clinical data", async () => {
  const createPatient = (phone: string, fullName: string) =>
    prisma.user.create({
      data: { fullName, phone, role: "PATIENT", isPhoneVerified: true },
    });
  const patientA = await createPatient("0971111111", "Patient A");
  const patientB = await createPatient("0972222222", "Patient B");

  const createAppointment = (owner: typeof patientA, code: string, startTime: string) =>
    prisma.appointment.create({
      data: {
        bookingCode: code,
        appointmentDate: dateOnly(fixture.appointmentDate),
        startTime,
        endTime: `${startTime.slice(0, 2)}:59`,
        status: "COMPLETED",
        patientName: owner.fullName,
        patientPhone: owner.phone!,
        patientId: owner.id,
        doctorId: fixture.doctorOne.id,
        departmentId: fixture.department.id,
        completedAt: new Date(),
      },
    });
  const appointmentB = await createAppointment(patientB, "XPAT-B", "15:00");
  const publishedRecordB = await prisma.medicalRecord.create({
    data: {
      recordCode: "XPAT-B-PUB",
      appointmentId: appointmentB.id,
      patientId: patientB.id,
      doctorId: fixture.doctorOne.id,
      status: "PUBLISHED",
      resultPdfUrl: "https://res.cloudinary.com/demo/image/upload/b-result.png",
      publishedAt: new Date(),
      labResults: {
        create: {
          testName: "B blood test",
          fileUrl: "https://res.cloudinary.com/demo/image/upload/b-lab.png",
        },
      },
    },
    include: { labResults: true },
  });
  const prescriptionB = await prisma.prescription.create({
    data: {
      prescriptionCode: "XPAT-B-RX",
      medicalRecordId: publishedRecordB.id,
      appointmentId: appointmentB.id,
      patientId: patientB.id,
      doctorId: fixture.doctorOne.id,
      status: "ISSUED",
      issuedAt: new Date(),
      items: { create: { medicineName: "B medicine", sortOrder: 0 } },
    },
  });
  const invoiceB = await prisma.invoice.create({
    data: {
      invoiceCode: "XPAT-B-INV",
      barcode: "XPAT-B-BAR",
      appointmentId: appointmentB.id,
      patientId: patientB.id,
      totalAmount: 100000,
      finalAmount: 100000,
    },
  });
  const dependentB = await prisma.dependentProfile.create({
    data: {
      ownerId: patientB.id,
      fullName: "B Child",
      relationship: "CHILD",
      dateOfBirth: new Date("2018-01-01"),
      gender: "MALE",
    },
  });

  // Bệnh nhân A có lịch và bệnh án nháp (chưa công bố) của chính mình.
  const appointmentA = await createAppointment(patientA, "XPAT-A", "16:00");
  const draftRecordA = await prisma.medicalRecord.create({
    data: {
      recordCode: "XPAT-A-DRAFT",
      appointmentId: appointmentA.id,
      patientId: patientA.id,
      doctorId: fixture.doctorOne.id,
      status: "DRAFT",
      diagnosis: "Chua cong bo",
    },
  });
  await prisma.prescription.create({
    data: {
      prescriptionCode: "XPAT-A-DRAFT-RX",
      medicalRecordId: draftRecordA.id,
      appointmentId: appointmentA.id,
      patientId: patientA.id,
      doctorId: fixture.doctorOne.id,
      status: "DRAFT",
      items: { create: { medicineName: "Draft medicine", sortOrder: 0 } },
    },
  });

  const authorization = `Bearer ${(await loginPatient(patientA.phone!)).accessToken}`;
  const as = (method: string, path: string, body?: unknown) =>
    http.request(`/api/v1/me${path}`, { method, headers: { authorization }, body });
  const labResultId = publishedRecordB.labResults[0].id;

  // Mọi tài nguyên của B đều không tồn tại với A (404, không phải 403, để không lộ sự tồn tại).
  const foreign: Array<[string, string, unknown?]> = [
    ["GET", `/appointments/${appointmentB.id}`],
    ["POST", `/appointments/${appointmentB.id}/cancel`, { reason: "Khong phai lich cua toi" }],
    ["GET", `/appointments/${appointmentB.id}/review`],
    ["GET", `/medical-records/${publishedRecordB.id}`],
    ["GET", `/medical-records/${publishedRecordB.id}/file`],
    ["GET", `/medical-records/${publishedRecordB.id}/lab-results/${labResultId}/file`],
    ["GET", `/prescriptions/${prescriptionB.id}`],
    ["GET", `/invoices/${invoiceB.id}`],
    ["POST", `/invoices/${invoiceB.id}/payments`, { provider: "VNPAY" }],
    ["PATCH", `/dependents/${dependentB.id}`, { fullName: "Hijacked" }],
    ["DELETE", `/dependents/${dependentB.id}`],
  ];
  for (const [method, path, body] of foreign) {
    const response = await as(method, path, body);
    assert.ok(
      [404, 400].includes(response.status) && response.status !== 200,
      `${method} ${path} -> ${response.status}`,
    );
    assert.notEqual(response.status, 403, `${method} ${path} must not reveal existence`);
  }
  assert.equal(
    (await prisma.dependentProfile.findUniqueOrThrow({ where: { id: dependentB.id } })).fullName,
    "B Child",
  );
  assert.equal(
    (await prisma.appointment.findUniqueOrThrow({ where: { id: appointmentB.id } })).status,
    "COMPLETED",
  );

  // Đặt lịch cho người thân của người khác bị từ chối.
  const stolenDependentBooking = await http.request("/api/v1/appointments", {
    method: "POST",
    headers: { authorization },
    body: { ...bookingBody({ phone: patientA.phone! }), dependentProfileId: dependentB.id },
  });
  assert.ok(
    [400, 403, 404].includes(stolenDependentBooking.status),
    `booking for another owner's dependent -> ${stolenDependentBooking.status}`,
  );

  // Dữ liệu y tế chưa công bố không lộ ra cho chính chủ.
  const records = await as("GET", "/medical-records");
  assert.equal(records.status, 200);
  assert.deepEqual(records.body.data, []);
  assert.equal((await as("GET", `/medical-records/${draftRecordA.id}`)).status, 404);
  const prescriptions = await as("GET", "/prescriptions");
  assert.equal(prescriptions.status, 200);
  assert.deepEqual(prescriptions.body.data, []);

  // Token bệnh nhân không dùng được cho dashboard và ngược lại.
  assert.equal(
    (
      await http.request("/api/dashboard/invoices", {
        headers: { authorization, "x-hospital-dashboard-request": "1" },
      })
    ).status,
    401,
  );
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");
  assert.equal(
    (await http.request("/api/v1/me", { headers: dashboardHeaders(adminCookie) })).status,
    401,
  );
});

// ---- Báo cho chủ tài khoản khi người khác đổi thông tin đăng nhập -----------------
test("the account owner is warned when an admin changes their email, phone, role or password", async () => {
  const { default: EmailService } = await import("../../src/services/email.service.js");
  const sent: Array<{ to: string; subject: string; text: string }> = [];
  const originalSend = EmailService.sendMail.bind(EmailService);
  EmailService.sendMail = async (input) => {
    sent.push({ to: input.to, subject: input.subject, text: input.text });
  };

  try {
    const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");
    const staff = await prisma.user.create({
      data: {
        fullName: "Notice Staff",
        phone: "0900000201",
        email: "owner.old@example.test",
        role: "STAFF",
        isPhoneVerified: true,
      },
    });
    const patch = (body: unknown) =>
      dashboardCall("PATCH", `/api/dashboard/users/${staff.id}`, adminCookie, body);

    // Đổi email: thư tới email CŨ, không lộ email mới.
    const emailChange = await patch({ email: "attacker.new@example.test" });
    assert.equal(emailChange.status, 200, JSON.stringify(emailChange.body));
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, "owner.old@example.test");
    assert.match(sent[0].text, /Email nhận mã đăng nhập/);
    assert.ok(!sent[0].text.includes("attacker.new"));

    // Đổi số điện thoại và vai trò: thư tới email hiện tại (đã là email mới sau lần đổi trước).
    const phoneAndRole = await patch({ phone: "0900000202", role: "PHARMACIST" });
    assert.equal(phoneAndRole.status, 200, JSON.stringify(phoneAndRole.body));
    assert.equal(sent.length, 2);
    assert.equal(sent[1].to, "attacker.new@example.test");
    assert.match(sent[1].text, /Số điện thoại đăng nhập/);
    assert.match(sent[1].text, /Vai trò/);

    // Đặt lại mật khẩu: có thư, và thư không chứa mật khẩu.
    const reset = await dashboardCall(
      "PATCH",
      `/api/dashboard/users/${staff.id}/password`,
      adminCookie,
      { password: "SecretTemp99" },
    );
    assert.equal(reset.status, 200);
    assert.equal(sent.length, 3);
    assert.match(sent[2].text, /Mật khẩu tài khoản đã được quản trị đặt lại/);
    assert.ok(!sent[2].text.includes("SecretTemp99"));

    // Đổi tên (không ảnh hưởng đăng nhập) thì không gửi thư.
    assert.equal((await patch({ fullName: "Renamed Staff" })).status, 200);
    assert.equal(sent.length, 3);

    // Tự sửa tài khoản của chính mình thì không cần cảnh báo.
    const selfEdit = await dashboardCall(
      "PATCH",
      `/api/dashboard/users/${fixture.adminUser.id}`,
      adminCookie,
      { email: "admin.self@example.test" },
    );
    assert.equal(selfEdit.status, 200);
    assert.equal(sent.length, 3);

    // Gửi thư lỗi không làm hỏng thao tác của quản trị.
    EmailService.sendMail = async () => {
      throw new Error("mail provider down");
    };
    const resilient = await patch({ email: "owner.third@example.test" });
    assert.equal(resilient.status, 200);
    assert.equal(
      (await prisma.user.findUniqueOrThrow({ where: { id: staff.id } })).email,
      "owner.third@example.test",
    );
  } finally {
    EmailService.sendMail = originalSend;
  }
});

// ---- Tải tệp kết quả khám (PDF, ảnh) an toàn ----------------------------------------
test("doctors upload private result files; content, size and role are enforced end to end", async () => {
  const { cloudinary } = await import("../../src/config/cloudinary.js");
  const uploader = cloudinary.uploader as unknown as Record<string, unknown>;
  const originalUpload = uploader.upload_stream;
  const originalDestroy = uploader.destroy;
  const destroyed: string[] = [];
  uploader.upload_stream = (
    options: { folder: string; public_id: string; resource_type: string; type: string },
    callback: (error: unknown, result: unknown) => void,
  ) => ({
    end(buffer: Buffer) {
      assert.equal(options.resource_type, "raw");
      assert.equal(options.type, "authenticated");
      callback(null, {
        secure_url: `https://res.cloudinary.com/demo/raw/authenticated/v1700000000/${options.folder}/${options.public_id}`,
        public_id: `${options.folder}/${options.public_id}`,
        bytes: buffer.length,
      });
    },
  });
  uploader.destroy = async (publicId: string) => {
    destroyed.push(publicId);
    return { result: "ok" };
  };

  const originalFetch = globalThis.fetch;
  try {
    const appointment = await createStoredAppointment({
      status: "COMPLETED",
      bookingCode: "MEDFILE-ONE",
    });
    const record = await prisma.medicalRecord.create({
      data: {
        recordCode: "MEDFILE-REC",
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        status: "DRAFT",
      },
    });
    const doctorCookie = await authCookie(fixture.doctorOneUser.id, "DOCTOR");
    const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");
    const staff = await createDashboardUser("STAFF", "0900000301");
    const staffCookie = await authCookie(staff.id, "STAFF");

    const pdfBytes = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(2048, 0x20)]);
    const upload = (cookie: string | undefined, bytes: Buffer, type: string, name = "ket-qua.pdf") => {
      const form = new FormData();
      form.append("file", new Blob([new Uint8Array(bytes)], { type }), name);
      return fetch(`${http.baseUrl}/api/uploads/medical-files`, {
        method: "POST",
        headers: cookie ? dashboardHeaders(cookie) : {},
        body: form,
      });
    };

    // Chỉ tài khoản có record.edit (bác sĩ) tải được.
    assert.equal((await upload(adminCookie, pdfBytes, "application/pdf")).status, 403);
    assert.equal((await upload(staffCookie, pdfBytes, "application/pdf")).status, 403);
    assert.equal((await upload(undefined, pdfBytes, "application/pdf")).status, 401);

    const ok = await upload(doctorCookie, pdfBytes, "application/pdf");
    assert.equal(ok.status, 201);
    const created = (await ok.json()) as { data: { item: { id: string; url: string; mimeType: string } } };
    const asset = created.data.item;
    assert.match(asset.url, /\/raw\/authenticated\//);
    assert.equal(asset.mimeType, "application/pdf");

    // Nội dung thật phải khớp: tệp thực thi đội lốt PDF, hoặc PDF khai báo là ảnh, đều bị từ chối.
    const fake = await upload(doctorCookie, Buffer.from("MZ\x90\x00 not a pdf"), "application/pdf");
    assert.equal(fake.status, 400);
    const mismatch = await upload(doctorCookie, pdfBytes, "image/png", "anh.png");
    assert.equal(mismatch.status, 400);
    // SVG và loại khác không được nhận.
    assert.equal((await upload(doctorCookie, Buffer.from("<svg/>"), "image/svg+xml", "x.svg")).status, 400);
    // Quá 10 MB.
    const big = Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(10 * 1024 * 1024 + 1)]);
    assert.equal((await upload(doctorCookie, big, "application/pdf")).status, 413);

    // Lưu đường dẫn vào hồ sơ: chỉ nhận nguồn lưu trữ của hệ thống, và tệp được gắn vào hồ sơ.
    const save = (url: string) =>
      dashboardCall("PATCH", `/api/dashboard/medical-records/${record.id}`, doctorCookie, { resultPdfUrl: url });
    assert.equal((await save("https://evil.example/ket-qua.pdf")).status, 400);
    assert.equal((await save("http://res.cloudinary.com/demo/raw/upload/x.pdf")).status, 400);
    assert.equal((await save(asset.url)).status, 200);
    const attached = await prisma.mediaAsset.findUniqueOrThrow({ where: { id: asset.id } });
    assert.equal(attached.isUsed, true);
    assert.equal(attached.ownerType, "MEDICAL_RESULT");
    assert.equal(attached.ownerId, record.id);

    // Lệnh dọn tệp không dùng không bao giờ xóa tệp kết quả khám, kể cả tệp chưa gắn.
    const orphanResponse = await upload(doctorCookie, pdfBytes, "application/pdf", "mo-coi.pdf");
    const orphan = ((await orphanResponse.json()) as { data: { item: { id: string } } }).data.item;
    await prisma.mediaAsset.update({
      where: { id: orphan.id },
      data: { createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000) },
    });
    const cleanup = await dashboardCall("POST", "/api/uploads/images/cleanup-unused", adminCookie, {
      olderThanHours: 24,
    });
    assert.equal(cleanup.status, 200);
    assert.deepEqual(destroyed, []);
    assert.ok(await prisma.mediaAsset.findUnique({ where: { id: orphan.id } }));

    // Bệnh nhân chỉ xem được sau khi công bố, qua cổng của mình: backend tự ký đường dẫn riêng tư,
    // trả đúng loại tệp và đuôi .pdf dù nơi lưu trả octet-stream.
    await prisma.medicalRecord.update({
      where: { id: record.id },
      data: { status: "PUBLISHED", publishedAt: new Date() },
    });
    const requested: string[] = [];
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const target = String(input);
      if (!target.includes("res.cloudinary.com")) return originalFetch(input, init);
      requested.push(target);
      return new Response(new Uint8Array(pdfBytes), {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      });
    }) as typeof fetch;
    const patientAuthorization = `Bearer ${(await loginPatient(appointment.patientPhone)).accessToken}`;
    const file = await fetch(`${http.baseUrl}/api/v1/me/medical-records/${record.id}/file`, {
      headers: { authorization: patientAuthorization },
    });
    assert.equal(file.status, 200);
    assert.equal(file.headers.get("content-type"), "application/pdf");
    assert.match(file.headers.get("content-disposition") ?? "", /\.pdf"/);
    assert.equal(requested.length, 1);
    assert.match(requested[0], /\/raw\/authenticated\/s--[^/]+--\/v1700000000\//);

    // Bác sĩ mở tệp trong dashboard cũng qua máy chủ (đường dẫn gốc của tệp riêng tư không mở được):
    // đúng loại tệp, đường dẫn được ký; bác sĩ khác (ngoài phạm vi) hoặc không có quyền thì từ chối.
    const dashboardFile = await fetch(`${http.baseUrl}/api/dashboard/medical-records/${record.id}/file`, {
      headers: dashboardHeaders(doctorCookie),
    });
    assert.equal(dashboardFile.status, 200);
    assert.equal(dashboardFile.headers.get("content-type"), "application/pdf");
    assert.equal(dashboardFile.headers.get("cache-control"), "private, no-store, max-age=0");
    assert.equal(requested.length, 2);
    assert.match(requested[1], /\/raw\/authenticated\/s--[^/]+--\/v1700000000\//);
    const otherDoctorCookie = await authCookie(fixture.doctorTwoUser.id, "DOCTOR");
    const otherDoctorFile = await fetch(`${http.baseUrl}/api/dashboard/medical-records/${record.id}/file`, {
      headers: dashboardHeaders(otherDoctorCookie),
    });
    assert.equal(otherDoctorFile.status, 404);
    const staffFile = await fetch(`${http.baseUrl}/api/dashboard/medical-records/${record.id}/file`, {
      headers: dashboardHeaders(staffCookie),
    });
    assert.equal(staffFile.status, 403);
  } finally {
    uploader.upload_stream = originalUpload;
    uploader.destroy = originalDestroy;
    globalThis.fetch = originalFetch;
  }
});

// ---- Xuất báo cáo CSV ------------------------------------------------------------------
test("CSV exports are permission-gated, audited, free of patient identity and safe in Excel", async () => {
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");
  const doctorCookie = await authCookie(fixture.doctorOneUser.id, "DOCTOR");
  const staff = await createDashboardUser("STAFF", "0900000401");
  const staffCookie = await authCookie(staff.id, "STAFF");
  const pharmacist = await createDashboardUser("PHARMACIST", "0900000402");
  const pharmacistCookie = await authCookie(pharmacist.id, "PHARMACIST");

  const get = async (path: string, cookie: string) => {
    const response = await fetch(`${http.baseUrl}${path}`, { headers: dashboardHeaders(cookie) });
    // fetch().text() tự cắt BOM; giải mã thủ công để kiểm tra BOM thật sự có trong tệp.
    const bytes = new Uint8Array(await response.arrayBuffer());
    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes);
    return { status: response.status, text, headers: response.headers };
  };

  // Một hóa đơn đã thu tiền mặt.
  const { invoice, appointment } = await createPayableInvoice({ bookingCode: "EXPORT-INV" });
  await InvoiceService.pay(invoice.id, { paymentMethod: "CASH" }, fixture.adminUser.id);

  // Hóa đơn: quản trị và nhân viên xuất được; bác sĩ và dược sĩ thì không.
  const invoices = await get("/api/dashboard/invoices/export?status=PAID", adminCookie);
  assert.equal(invoices.status, 200, invoices.text);
  assert.match(invoices.headers.get("content-type") ?? "", /text\/csv/);
  assert.match(invoices.headers.get("content-disposition") ?? "", /attachment; filename="hoa-don-\d{4}-\d{2}-\d{2}\.csv"/);
  assert.equal(invoices.headers.get("cache-control"), "private, no-store, max-age=0");
  assert.ok(invoices.text.startsWith("﻿Mã hóa đơn,"));
  assert.ok(invoices.text.includes(invoice.invoiceCode));
  assert.ok(invoices.text.includes("EXPORT-INV"));
  assert.ok(invoices.text.includes("Tiền mặt"));
  // Không đưa danh tính bệnh nhân vào tệp xuất.
  assert.ok(!invoices.text.includes(appointment.patientPhone));
  assert.ok(!invoices.text.includes(appointment.patientName));
  assert.equal((await get("/api/dashboard/invoices/export", staffCookie)).status, 200);
  assert.equal((await get("/api/dashboard/invoices/export", doctorCookie)).status, 403);
  assert.equal((await get("/api/dashboard/invoices/export", pharmacistCookie)).status, 403);

  // Bộ lọc và khoảng ngày sai bị từ chối; lọc theo trạng thái khác thì không có dòng nào.
  assert.equal((await get("/api/dashboard/invoices/export?status=BOGUS", adminCookie)).status, 400);
  assert.equal((await get("/api/dashboard/invoices/export?from=01-01-2026", adminCookie)).status, 400);
  assert.equal(
    (await get("/api/dashboard/invoices/export?from=2020-01-01&to=2026-01-01", adminCookie)).status,
    400,
  );
  const refunded = await get("/api/dashboard/invoices/export?status=REFUNDED", adminCookie);
  assert.equal(refunded.text.trim().split(/\r?\n/).length, 1); // chỉ có dòng tiêu đề

  // Doanh thu theo ngày có dòng tổng; chỉ người có stats.view.
  const revenue = await get("/api/dashboard/statistics/revenue/export", adminCookie);
  assert.equal(revenue.status, 200, revenue.text);
  assert.ok(revenue.text.includes("Tổng,"));
  assert.equal((await get("/api/dashboard/statistics/revenue/export", doctorCookie)).status, 403);

  // Kho thuốc: chỉ dược sĩ; tên thuốc dạng công thức bị chặn.
  await prisma.medicine.create({
    data: { code: "EXP-001", name: '=HYPERLINK("http://evil.example","Bam vao")', unit: "vien", stockQuantity: 3, minStock: 10 },
  });
  const inventory = await get("/api/dashboard/pharmacy/medicines/export", pharmacistCookie);
  assert.equal(inventory.status, 200, inventory.text);
  assert.ok(inventory.text.includes("EXP-001"));
  assert.ok(inventory.text.includes(`'=HYPERLINK`));
  assert.ok(!/(^|,)=HYPERLINK/m.test(inventory.text));
  assert.ok(inventory.text.includes("Có")); // dưới mức tối thiểu (3 < 10)
  assert.equal((await get("/api/dashboard/pharmacy/medicines/export", adminCookie)).status, 403);
  assert.equal((await get("/api/dashboard/pharmacy/movements/export", pharmacistCookie)).status, 200);
  assert.equal(
    (await get("/api/dashboard/pharmacy/movements/export?medicineId=khong-hop-le", pharmacistCookie)).status,
    400,
  );

  // Nhật ký truy cập: chỉ quản trị; mọi lần xuất đều để lại dấu vết (không ghi nội dung).
  assert.equal((await get("/api/dashboard/audit-logs/export", staffCookie)).status, 403);
  const audit = await get("/api/dashboard/audit-logs/export", adminCookie);
  assert.equal(audit.status, 200, audit.text);
  assert.ok(audit.text.includes("DATA_EXPORTED"));

  const exported = await prisma.auditLog.findMany({
    where: { action: "DATA_EXPORTED" },
    orderBy: { createdAt: "asc" },
  });
  // Giữ lần xuất đầu tiên của mỗi loại (hóa đơn được xuất nhiều lần với bộ lọc khác nhau).
  const byTarget: Record<string, (typeof exported)[number]> = {};
  for (const row of exported) byTarget[row.targetType ?? ""] ??= row;
  assert.ok(byTarget.INVOICES && byTarget.REVENUE_REPORT && byTarget.MEDICINE_INVENTORY && byTarget.AUDIT_LOGS);
  assert.equal((byTarget.INVOICES.meta as { rows: number }).rows, 1);
  assert.equal(byTarget.INVOICES.actorRole, "ADMIN");
  assert.ok(!JSON.stringify(exported.map((row) => row.meta)).includes(appointment.patientPhone));
});

// ---- Nhập CSV kho thuốc ------------------------------------------------------------------
const isoDateFromToday = (days: number) =>
  new Date(Date.now() + 7 * 3_600_000 + days * 86_400_000).toISOString().slice(0, 10);

test("batches: receipts by lot, FEFO dispensing and expired stock never dispensed", async () => {
  const pharmacist = await createDashboardUser("PHARMACIST", "0900000012");
  const cookie = await authCookie(pharmacist.id, "PHARMACIST");
  const medicine = await createMedicineViaApi(cookie, { code: "MED-LOT", name: "Thuốc theo lô" });
  const call = (path: string, method = "GET", body?: unknown) =>
    http.request(`/api/dashboard/pharmacy${path}`, { method, headers: dashboardHeaders(cookie), body });
  const receive = (body: Record<string, unknown>) => call(`/medicines/${medicine.id}/receipts`, "POST", body);

  // Khai thiếu một nửa, lô đã hết hạn, và cùng số lô khác hạn dùng đều bị từ chối.
  assert.equal((await receive({ quantity: 5, batchNumber: "L0" })).body.code, "BATCH_FIELDS_INCOMPLETE");
  assert.equal(
    (await receive({ quantity: 5, batchNumber: "L0", expiryDate: isoDateFromToday(-1) })).body.code,
    "BATCH_ALREADY_EXPIRED",
  );
  assert.equal((await receive({ quantity: 10, batchNumber: "L1", expiryDate: isoDateFromToday(400) })).status, 201);
  assert.equal((await receive({ quantity: 5, batchNumber: "L2", expiryDate: isoDateFromToday(100) })).status, 201);
  assert.equal(
    (await receive({ quantity: 1, batchNumber: "L1", expiryDate: isoDateFromToday(401) })).body.code,
    "BATCH_EXPIRY_MISMATCH",
  );
  // Nhập thêm cùng lô cùng hạn thì cộng dồn.
  assert.equal((await receive({ quantity: 2, batchNumber: "L1", expiryDate: isoDateFromToday(400) })).status, 201);

  const batches = await call(`/medicines/${medicine.id}/batches`);
  assert.equal(batches.status, 200);
  assert.deepEqual(
    batches.body.data.items.map((item: { batchNumber: string; quantity: number }) => [item.batchNumber, item.quantity]),
    [["L2", 5], ["L1", 12]],
  );
  assert.equal(batches.body.data.summary.stockQuantity, 17);

  // Lô đã hết hạn trong kho (giả lập lô nhập từ trước): không tính vào tồn cấp được.
  const expired = await prisma.stockBatch.create({
    data: {
      medicineId: medicine.id,
      batchNumber: "OLD",
      expiryDate: new Date(`${isoDateFromToday(-10)}T00:00:00.000Z`),
      receivedQuantity: 4,
      quantity: 4,
    },
  });
  await prisma.medicine.update({ where: { id: medicine.id }, data: { stockQuantity: { increment: 4 } } });
  const listed = await call(`/medicines?limit=100`);
  const row = listed.body.data.items.find((item: { id: string }) => item.id === medicine.id);
  assert.equal(row.stockQuantity, 21);
  assert.equal(row.sellableQuantity, 17);
  assert.equal(row.expiredQuantity, 4);
  assert.equal(row.nearestExpiry, isoDateFromToday(100));

  const alerts = await call("/medicines/expiry-alerts");
  assert.equal(alerts.status, 200);
  assert.deepEqual(
    alerts.body.data.items.map((item: { batchNumber: string; status: string }) => [item.batchNumber, item.status]),
    [["OLD", "EXPIRED"]],
  );

  // Cần 18 nhưng chỉ có 17 còn hạn: cả đơn bị từ chối, không lô nào bị trừ.
  const tooMuch = await createIssuedPrescription({
    code: "RX-LOT-BIG",
    phone: "0933333331",
    timeSlotId: fixture.slotOne.id,
    items: [{ medicineName: "Thuốc theo lô", quantity: 18, medicineId: medicine.id }],
  });
  const refused = await call(`/prescriptions/${tooMuch.prescription.id}/dispense`, "POST", { confirmed: true });
  assert.equal(refused.status, 409);
  assert.equal(refused.body.code, "INSUFFICIENT_STOCK");
  assert.equal((await prisma.medicine.findUniqueOrThrow({ where: { id: medicine.id } })).stockQuantity, 21);

  // Cần 8: lấy hết lô hết hạn sớm (L2 còn 5) rồi lấy 3 từ lô sau (L1).
  const small = await createIssuedPrescription({
    code: "RX-LOT-SMALL",
    phone: "0933333332",
    timeSlotId: fixture.slotTwo.id,
    items: [{ medicineName: "Thuốc theo lô", quantity: 8, medicineId: medicine.id }],
  });
  const ok = await call(`/prescriptions/${small.prescription.id}/dispense`, "POST", { confirmed: true });
  assert.equal(ok.status, 200);
  const after = await prisma.stockBatch.findMany({ where: { medicineId: medicine.id }, orderBy: { batchNumber: "asc" } });
  assert.deepEqual(
    after.map((item) => [item.batchNumber, item.quantity]),
    [["L1", 9], ["L2", 0], ["OLD", 4]],
  );
  const slices = await prisma.stockMovement.findMany({
    where: { type: "DISPENSE" },
    orderBy: { balanceAfter: "desc" },
    include: { batch: true },
  });
  assert.deepEqual(
    slices.map((item) => [item.batch?.batchNumber, item.quantity, item.balanceAfter]),
    [["L2", -5, 16], ["L1", -3, 13]],
  );
  assert.equal((await prisma.medicine.findUniqueOrThrow({ where: { id: medicine.id } })).stockQuantity, 13);

  // Hủy lô hết hạn bằng điều chỉnh theo lô; quá số còn lại thì bị từ chối.
  const tooBig = await call(`/medicines/${medicine.id}/adjustments`, "POST", { delta: -5, reason: "Hủy", batchId: expired.id });
  assert.equal(tooBig.status, 409);
  assert.equal(tooBig.body.code, "INSUFFICIENT_BATCH_STOCK");
  const written = await call(`/medicines/${medicine.id}/adjustments`, "POST", {
    delta: -4,
    reason: "Hủy thuốc hết hạn",
    batchId: expired.id,
  });
  assert.equal(written.status, 201);
  assert.equal(written.body.data.stockQuantity, 9);
  assert.equal((await prisma.stockBatch.findUniqueOrThrow({ where: { id: expired.id } })).quantity, 0);
});

test("pharmacy CSV receipts can carry lot and expiry; exports include them", async () => {
  const pharmacist = await createDashboardUser("PHARMACIST", "0900000413");
  const cookie = await authCookie(pharmacist.id, "PHARMACIST");
  const send = (csv: string, apply: boolean) =>
    http.request("/api/dashboard/pharmacy/import/receipts", {
      method: "POST",
      headers: dashboardHeaders(cookie),
      body: { csv, apply },
    });
  const plus = (days: number) => new Date(Date.now() + 7 * 3_600_000 + days * 86_400_000);
  const iso = (days: number) => plus(days).toISOString().slice(0, 10);
  const vn = (days: number) => iso(days).split("-").reverse().join("/");

  const medicine = await prisma.medicine.create({
    data: { code: "LOT-CSV", name: "Thuốc lô CSV", unit: "viên", stockQuantity: 5, minStock: 1 },
  });

  // Cùng thuốc nhiều lô trong một tệp là hợp lệ; ngày kiểu Việt Nam và ISO đều nhận.
  const csv = `Mã thuốc,Số lượng,Số lô,Hạn dùng,Lý do\r\nLOT-CSV,10,A1,${vn(200)},Phiếu 01\r\nLOT-CSV,6,B2,${iso(90)},Phiếu 01\r\n`;
  const preview = await send(csv, false);
  assert.equal(preview.status, 200, JSON.stringify(preview.body));
  assert.equal(preview.body.data.summary.errors, 0);
  assert.equal(preview.body.data.rows[0].batchNumber, "A1");
  assert.equal(preview.body.data.rows[0].expiryDate, iso(200));
  assert.equal(await prisma.stockBatch.count(), 0);

  // Lỗi: khai thiếu một nửa, hạn đã qua, ngày không có thật, lặp lô trong tệp.
  const bad = await send(
    `Mã thuốc,Số lượng,Số lô,Hạn dùng\r\nLOT-CSV,1,C3,\r\nLOT-CSV,1,D4,${vn(-1)}\r\nLOT-CSV,1,E5,31/02/2030\r\nLOT-CSV,1,F6,${vn(50)}\r\nLOT-CSV,1,f6,${vn(50)}\r\n`,
    true,
  );
  assert.equal(bad.body.data.applied, false);
  assert.deepEqual(
    bad.body.data.rows.map((row: { errors: string[] }) => row.errors.length > 0),
    [true, true, true, false, true],
  );

  const applied = await send(csv, true);
  assert.equal(applied.body.data.applied, true);
  assert.equal(applied.body.data.summary.totalQuantity, 16);
  const batches = await prisma.stockBatch.findMany({ where: { medicineId: medicine.id }, orderBy: { batchNumber: "asc" } });
  assert.deepEqual(batches.map((item) => [item.batchNumber, item.quantity]), [["A1", 10], ["B2", 6]]);
  assert.equal((await prisma.medicine.findUniqueOrThrow({ where: { id: medicine.id } })).stockQuantity, 21);

  // Cùng số lô với hạn dùng khác bị báo ngay ở bước xem trước; cùng hạn thì cộng dồn.
  const mismatch = await send(`Mã thuốc,Số lượng,Số lô,Hạn dùng\r\nLOT-CSV,1,A1,${iso(201)}\r\n`, false);
  assert.equal(mismatch.body.data.summary.errors, 1);
  assert.equal((await send(`Mã thuốc,Số lượng,Số lô,Hạn dùng\r\nLOT-CSV,4,A1,${iso(200)}\r\n`, true)).body.data.applied, true);
  assert.equal((await prisma.stockBatch.findFirstOrThrow({ where: { batchNumber: "A1" } })).quantity, 14);

  // Xuất tồn kho có hạn dùng gần nhất; xuất sổ kho có số lô.
  const download = async (path: string) => {
    const response = await fetch(`${http.baseUrl}${path}`, { headers: dashboardHeaders(cookie) });
    return { status: response.status, text: await response.text() };
  };
  const inventory = await download("/api/dashboard/pharmacy/medicines/export");
  assert.equal(inventory.status, 200);
  assert.ok(inventory.text.includes("Hạn dùng gần nhất"));
  assert.ok(inventory.text.includes(iso(90)));
  const movements = await download("/api/dashboard/pharmacy/movements/export");
  assert.equal(movements.status, 200);
  assert.ok(movements.text.includes("Số lô"));
  assert.ok(movements.text.includes("B2"));
});

test("pharmacy CSV import previews first, applies all-or-nothing and never overwrites stock", async () => {
  const pharmacist = await createDashboardUser("PHARMACIST", "0900000411");
  const cookie = await authCookie(pharmacist.id, "PHARMACIST");
  const staff = await createDashboardUser("STAFF", "0900000412");
  const staffCookie = await authCookie(staff.id, "STAFF");

  const send = (kind: "catalog" | "receipts", csv: string, apply: boolean, who = cookie) =>
    http.request(`/api/dashboard/pharmacy/import/${kind}`, {
      method: "POST",
      headers: dashboardHeaders(who),
      body: { csv, apply },
    });

  await prisma.medicine.create({
    data: { code: "IMP-OLD", name: "Thuốc cũ", unit: "viên", stockQuantity: 7, minStock: 2 },
  });

  // Danh mục: xem trước không ghi gì; có dòng lỗi thì không áp dụng dù apply=true.
  const catalogCsv =
    "\uFEFFMã thuốc,Tên thuốc,Đơn vị,Hàm lượng,Mức tối thiểu\r\n" +
    "imp-new,Thuốc mới,viên,500mg,20\r\n" +
    "IMP-OLD,Thuốc cũ đổi tên,,,\r\n";
  const preview = await send("catalog", catalogCsv, false);
  assert.equal(preview.status, 200, JSON.stringify(preview.body));
  assert.equal(preview.body.data.applied, false);
  assert.deepEqual(
    [preview.body.data.summary.create, preview.body.data.summary.update, preview.body.data.summary.errors],
    [1, 1, 0],
  );
  assert.equal(await prisma.medicine.count({ where: { code: "IMP-NEW" } }), 0);

  const bad = await send("catalog", catalogCsv + "IMP-BAD,,,,abc\r\nimp-new,Lặp,viên,,\r\n", true);
  assert.equal(bad.status, 200);
  assert.equal(bad.body.data.applied, false);
  assert.equal(bad.body.data.summary.errors, 2);
  assert.equal(await prisma.medicine.count({ where: { code: "IMP-NEW" } }), 0);

  const applied = await send("catalog", catalogCsv, true);
  assert.equal(applied.body.data.applied, true);
  const created = await prisma.medicine.findUniqueOrThrow({ where: { code: "IMP-NEW" } });
  assert.equal(created.name, "Thuốc mới");
  assert.equal(created.minStock, 20);
  assert.equal(created.stockQuantity, 0);
  const updated = await prisma.medicine.findUniqueOrThrow({ where: { code: "IMP-OLD" } });
  assert.equal(updated.name, "Thuốc cũ đổi tên");
  assert.equal(updated.minStock, 2); // ô trống giữ nguyên
  assert.equal(updated.stockQuantity, 7); // tệp danh mục không bao giờ đổi tồn

  // Nhập kho: đi qua sổ kho; một dòng sai thì không dòng nào được nhập.
  const failing = await send("receipts", "Mã thuốc,Số lượng\nIMP-OLD,10\nKHONG-CO,5\n", true);
  assert.equal(failing.body.data.applied, false);
  assert.equal(failing.body.data.rows[1].errors.length, 1);
  assert.equal((await prisma.medicine.findUniqueOrThrow({ where: { code: "IMP-OLD" } })).stockQuantity, 7);

  const receipts = await send("receipts", "Mã thuốc;Số lượng;Lý do\nIMP-OLD;10;Phiếu 01\nIMP-NEW;4;\n", true);
  assert.equal(receipts.status, 200, JSON.stringify(receipts.body));
  assert.equal(receipts.body.data.applied, true);
  assert.equal(receipts.body.data.summary.totalQuantity, 14);
  assert.equal((await prisma.medicine.findUniqueOrThrow({ where: { code: "IMP-OLD" } })).stockQuantity, 17);
  const movement = await prisma.stockMovement.findFirstOrThrow({
    where: { medicine: { code: "IMP-OLD" }, type: "RECEIPT" },
  });
  assert.equal(movement.quantity, 10);
  assert.equal(movement.balanceAfter, 17);
  assert.equal(movement.reason, "Phiếu 01");

  // Số âm, số thập phân và thuốc lặp trong tệp bị từ chối.
  const invalid = await send("receipts", "Mã thuốc,Số lượng\nIMP-OLD,-3\nIMP-OLD,1.5\n", false);
  assert.equal(invalid.body.data.summary.errors, 2);

  // Phân quyền và dấu vết kiểm toán (không ghi nội dung tệp).
  assert.equal((await send("catalog", catalogCsv, false, staffCookie)).status, 403);
  assert.equal((await send("receipts", "Mã thuốc,Số lượng\nIMP-OLD,1\n", true, staffCookie)).status, 403);
  assert.equal((await send("catalog", "Tên thuốc\nX\n", false)).status, 400);

  const audits = await prisma.auditLog.findMany({ where: { action: "DATA_IMPORTED" }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(audits.map((row) => row.targetType), ["MEDICINE_CATALOG", "STOCK_RECEIPTS"]);
  assert.equal((audits[1].meta as { totalQuantity: number }).totalQuantity, 14);
});

test("staff inbox: announcements by role and internal appointment events", async () => {
  const { default: StaffNotificationService } = await import(
    "../../src/services/staffNotification.service.js"
  );
  const staff = await createDashboardUser("STAFF", "0900000031");
  const pharmacist = await createDashboardUser("PHARMACIST", "0900000032");
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");
  const staffCookie = await authCookie(staff.id, "STAFF");
  const doctorCookie = await authCookie(fixture.doctorOneUser.id, "DOCTOR");
  const pharmacistCookie = await authCookie(pharmacist.id, "PHARMACIST");
  const post = (cookie: string, body: unknown) =>
    http.request("/api/dashboard/notifications", {
      method: "POST",
      headers: dashboardHeaders(cookie),
      body,
    });
  const get = (path: string, cookie: string) =>
    http.request(path, { headers: dashboardHeaders(cookie) });

  // Gửi theo vai trò: chỉ bác sĩ nhận, nhân viên và dược sĩ không thấy.
  const toDoctors = await post(adminCookie, {
    title: "Họp khoa sáng mai",
    body: "Toàn bộ bác sĩ họp khoa lúc 8 giờ sáng mai.",
    audience: "ROLE_DOCTOR",
  });
  assert.equal(toDoctors.status, 201);
  const doctorInbox = await get("/api/dashboard/inbox", doctorCookie);
  assert.equal(doctorInbox.status, 200);
  assert.equal(doctorInbox.body.data.items.length, 1);
  assert.equal(doctorInbox.body.data.items[0].title, "Họp khoa sáng mai");
  assert.equal(doctorInbox.body.data.meta.unreadCount, 1);
  assert.equal((await get("/api/dashboard/inbox", staffCookie)).body.data.items.length, 0);
  assert.equal((await get("/api/dashboard/inbox", pharmacistCookie)).body.data.items.length, 0);

  // Gửi cho một nhân sự cụ thể; thiếu người nhận hoặc gửi nhầm người khám bị từ chối.
  assert.equal((await post(adminCookie, { title: "Riêng tư", body: "Nội dung riêng cho một người", audience: "ONE_USER" })).status, 400);
  const toOne = await post(adminCookie, {
    title: "Nhắc riêng dược sĩ",
    body: "Kiểm tra lô thuốc sắp hết hạn trong kho.",
    audience: "ONE_USER",
    userId: pharmacist.id,
  });
  assert.equal(toOne.status, 201);
  assert.equal(toOne.body.data.recipientCount, 1);
  assert.equal((await get("/api/dashboard/inbox/unread-count", pharmacistCookie)).body.data.unreadCount, 1);

  // Đánh dấu đã đọc: chỉ trong hộp thư của chính mình.
  const itemId = doctorInbox.body.data.items[0].id;
  const foreign = await http.request(`/api/dashboard/inbox/${itemId}/read`, {
    method: "PATCH",
    headers: dashboardHeaders(staffCookie),
  });
  assert.equal(foreign.status, 404);
  const read = await http.request(`/api/dashboard/inbox/${itemId}/read`, {
    method: "PATCH",
    headers: dashboardHeaders(doctorCookie),
  });
  assert.equal(read.status, 200);
  assert.equal((await get("/api/dashboard/inbox/unread-count", doctorCookie)).body.data.unreadCount, 0);

  // Sự kiện lịch hẹn: bác sĩ phụ trách và lễ tân nhận; người thực hiện thì không tự nhận.
  const patient = await prisma.user.create({
    data: { fullName: "Người khám sự kiện", phone: "0987000051", role: "PATIENT", isActive: true },
  });
  const appointment = await prisma.appointment.create({
    data: {
      bookingCode: "STAFF-EVENT-1",
      appointmentDate: dateOnly(fixture.appointmentDate),
      startTime: fixture.slotOne.startTime,
      endTime: fixture.slotOne.endTime,
      status: "PENDING_CONFIRM",
      patientName: patient.fullName,
      patientPhone: patient.phone!,
      patientId: patient.id,
      doctorId: fixture.doctorOne.id,
      departmentId: fixture.department.id,
      timeSlotId: fixture.slotOne.id,
      estimatedPrice: 300000,
      finalAmount: 300000,
    },
  });
  await StaffNotificationService.notifyAppointmentEvent(appointment.id, "CREATED", {
    includeReception: true,
  });
  const doctorEvents = await get("/api/dashboard/inbox", doctorCookie);
  assert.ok(doctorEvents.body.data.items.some((item: { type: string }) => item.type === "APPOINTMENT_CREATED"));
  const staffEvents = await get("/api/dashboard/inbox", staffCookie);
  assert.equal(staffEvents.body.data.items.length, 1);
  assert.equal(staffEvents.body.data.items[0].entityType, "APPOINTMENT");

  // Gọi lại cùng sự kiện không tạo bản ghi trùng.
  await StaffNotificationService.notifyAppointmentEvent(appointment.id, "CREATED", {
    includeReception: true,
  });
  assert.equal((await get("/api/dashboard/inbox", staffCookie)).body.data.items.length, 1);

  // Người tự xác nhận lịch của mình không nhận thông báo về chính thao tác đó.
  await StaffNotificationService.notifyAppointmentEvent(appointment.id, "CONFIRMED", {
    actorId: fixture.doctorOneUser.id,
  });
  const afterSelf = await get("/api/dashboard/inbox", doctorCookie);
  assert.ok(!afterSelf.body.data.items.some((item: { type: string }) => item.type === "APPOINTMENT_CONFIRMED"));
});

test("pharmacy alerts reach pharmacists once a day and broadcast needs its own permission", async () => {
  const { default: PharmacyService } = await import("../../src/services/pharmacy.service.js");
  const pharmacist = await createDashboardUser("PHARMACIST", "0900000041");
  const staff = await createDashboardUser("STAFF", "0900000042");
  const pharmacistCookie = await authCookie(pharmacist.id, "PHARMACIST");
  const staffCookie = await authCookie(staff.id, "STAFF");
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");
  const get = (path: string, cookie: string) =>
    http.request(path, { headers: dashboardHeaders(cookie) });

  await prisma.medicine.create({
    data: { code: "LOWSTOCK1", name: "Thuốc sắp hết", unit: "viên", stockQuantity: 3, minStock: 10 },
  });
  await PharmacyService.notifyStockAlerts();
  await PharmacyService.notifyStockAlerts();
  const inbox = await get("/api/dashboard/inbox", pharmacistCookie);
  const lowStock = inbox.body.data.items.filter((item: { title: string }) => item.title === "Thuốc sắp hết");
  assert.equal(lowStock.length, 1);
  assert.match(lowStock[0].body, /còn 3 viên/);
  // Chỉ dược sĩ nhận; quản trị và nhân viên không.
  assert.equal((await get("/api/dashboard/inbox", adminCookie)).body.data.items.length, 0);
  assert.equal((await get("/api/dashboard/inbox", staffCookie)).body.data.items.length, 0);

  // Gửi thông báo cần quyền riêng: nhân viên tiếp nhận được (mặc định), dược sĩ thì không.
  const payload = { title: "Thông báo thử quyền", body: "Nội dung kiểm tra quyền gửi thông báo.", audience: "ROLE_DOCTOR" };
  const asPharmacist = await http.request("/api/dashboard/notifications", {
    method: "POST",
    headers: dashboardHeaders(pharmacistCookie),
    body: payload,
  });
  assert.equal(asPharmacist.status, 403);
  const asStaff = await http.request("/api/dashboard/notifications", {
    method: "POST",
    headers: dashboardHeaders(staffCookie),
    body: payload,
  });
  assert.equal(asStaff.status, 201);
});

test("doctor schedule: rolling slots, schedule changes keep booked visits, range closing", async () => {
  const { default: SlotPlannerService } = await import("../../src/services/slotPlanner.service.js");
  const { default: DoctorScheduleService } = await import("../../src/services/doctorSchedule.service.js");
  const staff = await createDashboardUser("STAFF", "0900000051");
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");
  const doctorCookie = await authCookie(fixture.doctorOneUser.id, "DOCTOR");
  const staffCookie = await authCookie(staff.id, "STAFF");
  const post = (path: string, cookie: string, body: unknown) =>
    http.request(path, { method: "POST", headers: dashboardHeaders(cookie), body });

  // Dọn lịch mẫu và khung giờ của fixture để đếm chính xác.
  await prisma.doctorTimeSlot.deleteMany({ where: { doctorId: fixture.doctorOne.id, appointment: { is: null } } });
  await prisma.doctorSchedule.deleteMany({ where: { doctorId: fixture.doctorOne.id } });

  // Tạo ca mẫu cho cả 7 ngày trong tuần: cửa sổ 14 ngày phải có đúng 2 ngày mỗi thứ (trừ giờ đã qua hôm nay).
  const created = [];
  for (let day = 0; day < 7; day += 1) {
    created.push(
      await DoctorScheduleService.create({
        doctorId: fixture.doctorOne.id,
        dayOfWeek: day,
        startTime: "08:00",
        endTime: "09:00",
        slotDuration: 30,
      }),
    );
  }
  const slots = await prisma.doctorTimeSlot.findMany({ where: { doctorId: fixture.doctorOne.id } });
  assert.ok(slots.length >= 26 && slots.length <= 28, `expected about 28 slots, got ${slots.length}`);
  assert.ok(slots.every((slot) => slot.scheduleId));

  // Gọi lại không sinh trùng.
  const again = await SlotPlannerService.refreshDoctor(fixture.doctorOne.id);
  assert.equal(again.generatedCount, 0);

  // Có một lịch đã đặt trong tương lai; đổi giờ ca đó phải gỡ khung giờ trống nhưng giữ lịch đã đặt.
  const target = await prisma.doctorTimeSlot.findFirstOrThrow({
    where: { doctorId: fixture.doctorOne.id, date: { gt: new Date() }, startTime: "08:00" },
    orderBy: { date: "asc" },
  });
  const patient = await prisma.user.create({
    data: { fullName: "Người khám lịch mẫu", phone: "0987000061", role: "PATIENT", isActive: true },
  });
  const appointment = await prisma.appointment.create({
    data: {
      bookingCode: "SCHEDULE-IMPACT-1",
      appointmentDate: target.date,
      startTime: target.startTime,
      endTime: target.endTime,
      status: "CONFIRMED",
      patientName: patient.fullName,
      patientPhone: patient.phone!,
      patientId: patient.id,
      doctorId: fixture.doctorOne.id,
      departmentId: fixture.department.id,
      timeSlotId: target.id,
      estimatedPrice: 300000,
      finalAmount: 300000,
    },
  });
  await prisma.doctorTimeSlot.update({ where: { id: target.id }, data: { status: "BOOKED" } });
  const bookedSchedule = created.find((item) => item.dayOfWeek === target.date.getUTCDay())!;
  const deactivated = await DoctorScheduleService.update(bookedSchedule.id, { isActive: false });
  assert.equal(deactivated.impact.affected.length, 1);
  assert.equal(deactivated.impact.affected[0].bookingCode, "SCHEDULE-IMPACT-1");
  assert.ok(deactivated.impact.removedSlots >= 1);
  const kept = await prisma.doctorTimeSlot.findUnique({ where: { id: target.id } });
  assert.equal(kept?.status, "BOOKED");
  const stillBooked = await prisma.appointment.findUnique({ where: { id: appointment.id } });
  assert.equal(stillBooked?.status, "CONFIRMED");
  // Nhân viên tiếp nhận được báo để liên hệ người khám.
  const staffInbox = await http.request("/api/dashboard/inbox", { headers: dashboardHeaders(staffCookie) });
  assert.ok(staffInbox.body.data.items.some((item: { title: string }) => item.title.includes("cần xử lý")));

  // Đóng lịch theo khoảng ngày: khóa khung giờ trống; bác sĩ khác không được thao tác.
  const from = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const closed = await post("/api/dashboard/doctor-time-slots/close-range", doctorCookie, {
    doctorId: fixture.doctorOne.id,
    from,
    to,
    reason: "Nghỉ phép năm",
  });
  assert.equal(closed.status, 200);
  assert.ok(closed.body.data.lockedSlots >= 1);
  const lockedSlots = await prisma.doctorTimeSlot.count({
    where: { doctorId: fixture.doctorOne.id, status: "LOCKED", lockReason: "Nghỉ phép năm" },
  });
  assert.equal(lockedSlots, closed.body.data.lockedSlots);
  const outsider = await post("/api/dashboard/doctor-time-slots/close-range", await authCookie(fixture.doctorTwoUser.id, "DOCTOR"), {
    doctorId: fixture.doctorOne.id,
    from,
    to,
    reason: "Nghỉ phép",
  });
  assert.equal(outsider.status, 403);

  const reopened = await post("/api/dashboard/doctor-time-slots/reopen-range", adminCookie, {
    doctorId: fixture.doctorOne.id,
    from,
    to,
  });
  assert.equal(reopened.status, 200);
  assert.equal(reopened.body.data.reopenedSlots, closed.body.data.lockedSlots);
});

test("invoices bill prescribed stock medicines, and unpaid invoices get exactly one reminder", async () => {
  const { default: InvoiceService } = await import("../../src/services/invoice.service.js");
  const staff = await createDashboardUser("STAFF", "0900000071");
  const staffCookie = await authCookie(staff.id, "STAFF");

  const pricedMedicine = await prisma.medicine.create({ data: { code: "BILL-PRICED", name: "Thuốc có giá", unit: "viên", unitPrice: 2500 } });
  const freeMedicine = await prisma.medicine.create({ data: { code: "BILL-FREE", name: "Thuốc không giá", unit: "viên" } });

  const { appointment } = await createIssuedPrescription({
    code: "RX-BILL",
    phone: "0944000071",
    timeSlotId: fixture.slotOne.id,
    items: [
      { medicineName: "Thuốc có giá", quantity: 4, medicineId: pricedMedicine.id },
      { medicineName: "Thuốc không giá", quantity: 3, medicineId: freeMedicine.id },
      { medicineName: "Thuốc mua ngoài", quantity: 2 },
    ],
  });

  const created = await http.request(`/api/dashboard/invoices/appointments/${appointment.id}`, {
    method: "POST",
    headers: dashboardHeaders(staffCookie),
    body: {},
  });
  assert.equal(created.status, 201);
  const items = created.body.data.items as { type: string; description: string; quantity: number; unitPrice: number; amount: number }[];
  const medicineLines = items.filter((item) => item.type === "MEDICINE");
  assert.equal(medicineLines.length, 1);
  assert.equal(medicineLines[0].quantity, 4);
  assert.equal(medicineLines[0].unitPrice, 2500);
  assert.equal(medicineLines[0].amount, 10000);
  const consultation = items.filter((item) => item.type !== "MEDICINE").reduce((sum, item) => sum + item.amount, 0);
  assert.equal(created.body.data.totalAmount, consultation + 10000);

  // Nhắc thanh toán: chưa đủ 24 giờ thì chưa nhắc, sau 24 giờ nhắc đúng một lần.
  const early = await InvoiceService.sendPaymentReminders();
  assert.equal(early.reminded, 0);
  const later = new Date(Date.now() + 25 * 60 * 60 * 1000);
  const first = await InvoiceService.sendPaymentReminders({ now: later });
  assert.equal(first.reminded, 1);
  const second = await InvoiceService.sendPaymentReminders({ now: later });
  assert.equal(second.reminded, 0);
  const reminders = await prisma.notification.count({
    where: { userId: appointment.patientId, title: "Hóa đơn đang chờ thanh toán" },
  });
  assert.equal(reminders, 1);

  // Hóa đơn đã thanh toán thì không nhắc nữa.
  await prisma.invoice.update({ where: { id: created.body.data.id }, data: { status: "PAID", paidAt: new Date() } });
  const afterPaid = await InvoiceService.sendPaymentReminders({ now: new Date(Date.now() + 49 * 60 * 60 * 1000) });
  assert.equal(afterPaid.reminded, 0);
});

test("completing a visit tells reception to issue the invoice", async () => {
  const staff = await createDashboardUser("STAFF", "0900000072");
  const staffCookie = await authCookie(staff.id, "STAFF");
  const doctorCookie = await authCookie(fixture.doctorOneUser.id, "DOCTOR");
  const appointment = await createStoredAppointment({ status: "CHECKED_IN", bookingCode: "BK-COMPLETE-NOTE", phone: "0944000072", timeSlotId: fixture.slotTwo.id });
  const started = await http.request(`/api/dashboard/appointments/${appointment.id}/start`, { method: "PATCH", headers: dashboardHeaders(doctorCookie) });
  assert.equal(started.status, 200);
  const finished = await http.request(`/api/dashboard/appointments/${appointment.id}/complete`, { method: "PATCH", headers: dashboardHeaders(doctorCookie) });
  assert.equal(finished.status, 200);
  const inbox = await http.request("/api/dashboard/inbox", { headers: dashboardHeaders(staffCookie) });
  assert.ok(inbox.body.data.items.some((item: { title: string }) => item.title.includes("chờ lập hóa đơn")));
});
