import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { getCookie, startHttpServer } from "../support/http.js";

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
  { signLookupGrant },
  { default: ScheduleReconciliationService },
  { default: AuthSessionService },
  { default: NotificationService },
  { default: MedicalRecordService },
  { default: PrescriptionService },
  { default: InvoiceService },
  { isFirebaseAdminConfigured },
] = await Promise.all([
  import("../../src/app.js"),
  import("../../src/config/prisma.js"),
  import("../../src/utils/jwt.js"),
  import("../../src/services/authOtp.service.js"),
  import("../../src/services/appointment.service.js"),
  import("../../src/utils/lookupGrant.js"),
  import("../../src/services/scheduleReconciliation.service.js"),
  import("../../src/services/authSession.service.js"),
  import("../../src/services/notification.service.js"),
  import("../../src/services/medicalRecord.service.js"),
  import("../../src/services/prescription.service.js"),
  import("../../src/services/invoice.service.js"),
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

const authCookie = async (userId: string, role: "ADMIN" | "DOCTOR") => {
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
  await prisma.package.createMany({
    data: [
      {
        name: "Gói tim mạch phổ biến",
        slug: "goi-tim-mach-pho-bien",
        departmentId: fixture.department.id,
        basePrice: 1200000,
        isPopular: true,
        isBHYTSupport: true,
      },
      {
        name: "Gói kiểm tra cơ bản",
        slug: "goi-kiem-tra-co-ban",
        departmentId: fixture.department.id,
        basePrice: 600000,
      },
    ],
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
  const cookie = await authCookie(fixture.adminUser.id, "ADMIN");
  const endpoint = `/api/dashboard/appointments/${appointment.id}`;

  const [start, noShow] = await Promise.all([
    http.request(`${endpoint}/start`, {
      method: "PATCH",
      headers: dashboardHeaders(cookie),
    }),
    http.request(`${endpoint}/no-show`, {
      method: "PATCH",
      headers: dashboardHeaders(cookie),
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
  const cookie = await authCookie(fixture.adminUser.id, "ADMIN");
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

test("lookup OTP returns the existing appointment list", async () => {
  const phone = "0911111111";
  const appointment = await createStoredAppointment({
    status: "CONFIRMED",
    phone,
    bookingCode: "PHASE0-LOOKUP",
  });

  const requestOtp = await http.request(
    "/api/appointments/lookup/request-otp",
    {
      method: "POST",
      body: { phone, bookingCode: appointment.bookingCode },
    },
  );
  assert.equal(requestOtp.status, 200);

  const verifyOtp = await http.request(
    "/api/appointments/lookup/verify-otp",
    {
      method: "POST",
      body: {
        phone,
        bookingCode: appointment.bookingCode,
        otp: requestOtp.body.data.debugOtp,
      },
    },
  );

  assert.equal(verifyOtp.status, 200);
  assert.equal(verifyOtp.body.success, true);
  assert.equal(verifyOtp.body.data.items.length, 1);
  assert.equal(verifyOtp.body.data.items[0].id, appointment.id);
  assert.equal(verifyOtp.body.data.grant.tokenType, "Bearer");
  assert.equal(typeof verifyOtp.body.data.grant.token, "string");
});

test("medical results require a valid scoped grant for the same patient", async () => {
  const phone = "0911111111";
  const appointment = await createStoredAppointment({
    status: "COMPLETED",
    phone,
    bookingCode: "PHASE0-RESULT-A",
  });
  await prisma.medicalRecord.create({
    data: {
      recordCode: "PHASE0-RECORD-A",
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      doctorId: fixture.doctorOne.id,
      status: "PUBLISHED",
      diagnosis: "Protected diagnosis A",
      publishedAt: new Date(),
    },
  });

  const requestOtp = await http.request(
    "/api/appointments/lookup/request-otp",
    {
      method: "POST",
      body: { phone, bookingCode: appointment.bookingCode },
    },
  );
  const verifyOtp = await http.request(
    "/api/appointments/lookup/verify-otp",
    {
      method: "POST",
      body: {
        phone,
        bookingCode: appointment.bookingCode,
        otp: requestOtp.body.data.debugOtp,
      },
    },
  );
  const lookupToken = verifyOtp.body.data.grant.token as string;
  const resultPath = `/api/appointments/lookup/result?bookingCode=${appointment.bookingCode}`;

  const missingGrant = await http.request(resultPath);
  assert.equal(missingGrant.status, 401);

  const authorized = await http.request(resultPath, {
    headers: { authorization: `Bearer ${lookupToken}` },
  });
  assert.equal(authorized.status, 200);
  assert.equal(
    authorized.body.data.medicalRecord.diagnosis,
    "Protected diagnosis A",
  );

  const patientB = await prisma.user.create({
    data: {
      fullName: "Patient B",
      phone: "0933333333",
      role: "PATIENT",
      isPhoneVerified: true,
    },
  });
  const appointmentB = await prisma.appointment.create({
    data: {
      bookingCode: "PHASE0-RESULT-B",
      appointmentDate: dateOnly(fixture.appointmentDate),
      startTime: "11:00",
      endTime: "11:30",
      status: "COMPLETED",
      patientName: patientB.fullName,
      patientPhone: patientB.phone!,
      patientId: patientB.id,
      doctorId: fixture.doctorOne.id,
      departmentId: fixture.department.id,
    },
  });

  const crossPatient = await http.request(
    `/api/appointments/lookup/result?bookingCode=${appointmentB.bookingCode}`,
    { headers: { authorization: `Bearer ${lookupToken}` } },
  );
  assert.equal(crossPatient.status, 404);

  const restrictedGrant = signLookupGrant({
    patientId: appointment.patientId,
    scopes: ["appointments:read"],
  });
  const wrongScope = await http.request(resultPath, {
    headers: { authorization: `Bearer ${restrictedGrant.token}` },
  });
  assert.equal(wrongScope.status, 403);

  const wrongAudienceToken = jwt.sign(
    {
      scopes: ["results:read"],
      purpose: "LOOKUP_RESULT",
      verifiedAt: new Date().toISOString(),
    },
    process.env.LOOKUP_GRANT_SECRET!,
    {
      audience: "wrong-audience",
      subject: appointment.patientId,
      expiresIn: "5m",
    },
  );
  const wrongAudience = await http.request(resultPath, {
    headers: { authorization: `Bearer ${wrongAudienceToken}` },
  });
  assert.equal(wrongAudience.status, 401);

  const expiredToken = jwt.sign(
    {
      scopes: ["results:read"],
      purpose: "LOOKUP_RESULT",
      verifiedAt: new Date(Date.now() - 60_000).toISOString(),
    },
    process.env.LOOKUP_GRANT_SECRET!,
    {
      audience: "patient-lookup",
      subject: appointment.patientId,
      expiresIn: -1,
    },
  );
  const expired = await http.request(resultPath, {
    headers: { authorization: `Bearer ${expiredToken}` },
  });
  assert.equal(expired.status, 401);
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
      provider: "MOCK",
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

test("payment APIs enforce grant ownership and the mock capability gate", async () => {
  const appointment = await createStoredAppointment({
    status: "COMPLETED",
    bookingCode: "PHASE0-PAYMENT",
  });
  const invoice = await prisma.invoice.create({
    data: {
      invoiceCode: "PHASE0-INVOICE",
      barcode: "PHASE0-BARCODE",
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      totalAmount: 300000,
      finalAmount: 300000,
    },
  });
  const patientGrant = signLookupGrant({ patientId: appointment.patientId });
  const authorization = `Bearer ${patientGrant.token}`;

  const missingGrant = await http.request(
    `/api/payments/invoices/${invoice.id}/create`,
    { method: "POST", body: { provider: "MOCK" } },
  );
  assert.equal(missingGrant.status, 401);

  const capabilities = await http.request("/api/payments/capabilities", {
    headers: { authorization },
  });
  assert.equal(capabilities.status, 200);
  assert.deepEqual(
    capabilities.body.data.providers.map(
      (item: { provider: string }) => item.provider,
    ),
    ["MOCK"],
  );

  const createResponses = await Promise.all(
    Array.from({ length: 10 }, () =>
      http.request(`/api/payments/invoices/${invoice.id}/create`, {
        method: "POST",
        headers: {
          authorization,
          "idempotency-key": "phase0-payment-create-retry",
        },
        body: { provider: "MOCK" },
      }),
    ),
  );
  assert.ok(createResponses.every((response) => response.status === 201));
  const [created] = createResponses;
  assert.equal(created.body.data.provider, "MOCK");
  assert.equal(
    new Set(createResponses.map((response) => response.body.data.id)).size,
    1,
  );
  assert.equal(
    await prisma.paymentTransaction.count({
      where: { invoiceId: invoice.id, status: "PENDING" },
    }),
    1,
  );

  const idempotentRetry = await http.request(
    `/api/payments/invoices/${invoice.id}/create`,
    {
      method: "POST",
      headers: {
        authorization,
        "idempotency-key": "phase0-payment-create-retry",
      },
      body: { provider: "MOCK" },
    },
  );
  assert.equal(idempotentRetry.status, 201);
  assert.equal(idempotentRetry.body.data.id, created.body.data.id);

  const patientB = await prisma.user.create({
    data: {
      fullName: "Payment Patient B",
      phone: "0944444444",
      role: "PATIENT",
      isPhoneVerified: true,
    },
  });
  const patientBGrant = signLookupGrant({ patientId: patientB.id });
  const patientBAuthorization = `Bearer ${patientBGrant.token}`;

  const crossPatientRead = await http.request(
    `/api/payments/${created.body.data.id}`,
    { headers: { authorization: patientBAuthorization } },
  );
  assert.equal(crossPatientRead.status, 404);

  const crossPatientSettlement = await http.request(
    `/api/payments/mock/${created.body.data.transactionCode}/success`,
    {
      method: "POST",
      headers: { authorization: patientBAuthorization },
    },
  );
  assert.equal(crossPatientSettlement.status, 404);

  const settlementWithoutGrant = await http.request(
    `/api/payments/mock/${created.body.data.transactionCode}/success`,
    { method: "POST" },
  );
  assert.equal(settlementWithoutGrant.status, 401);

  const settlements = await Promise.all([
    http.request(
      `/api/payments/mock/${created.body.data.transactionCode}/success`,
      { method: "POST", headers: { authorization } },
    ),
    http.request(
      `/api/payments/mock/${created.body.data.transactionCode}/success`,
      { method: "POST", headers: { authorization } },
    ),
  ]);
  assert.ok(settlements.every((response) => response.status === 200));
  assert.ok(
    settlements.every((response) => response.body.data.status === "SUCCESS"),
  );

  const paidInvoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoice.id },
    select: { status: true },
  });
  assert.equal(paidInvoice.status, "PAID");

  const dashboardInvoice = await http.request(
    `/api/dashboard/invoices/${invoice.id}`,
    {
      headers: dashboardHeaders(
        await authCookie(fixture.adminUser.id, "ADMIN"),
      ),
    },
  );
  assert.equal(dashboardInvoice.status, 200);
  assert.equal(dashboardInvoice.body.data.paymentTransactions.length, 1);
  assert.equal(
    dashboardInvoice.body.data.paymentTransactions[0].status,
    "SUCCESS",
  );
  assert.equal(
    dashboardInvoice.body.data.paymentTransactions[0].rawResponse,
    undefined,
  );

  const expirySlot = await prisma.doctorTimeSlot.create({
    data: {
      doctorId: fixture.doctorOne.id,
      date: dateOnly(fixture.appointmentDate),
      startTime: "11:00",
      endTime: "11:30",
    },
  });
  const expiringAppointment = await createStoredAppointment({
    status: "COMPLETED",
    bookingCode: "PHASE0-PAYMENT-EXPIRY",
    phone: "0911111122",
    timeSlotId: expirySlot.id,
  });
  const expiringInvoice = await prisma.invoice.create({
    data: {
      invoiceCode: "PHASE0-INVOICE-EXPIRY",
      barcode: "PHASE0-BARCODE-EXPIRY",
      appointmentId: expiringAppointment.id,
      patientId: expiringAppointment.patientId,
      totalAmount: 200000,
      finalAmount: 200000,
    },
  });
  const expiryAuthorization = `Bearer ${
    signLookupGrant({ patientId: expiringAppointment.patientId }).token
  }`;
  const expiringPayment = await http.request(
    `/api/payments/invoices/${expiringInvoice.id}/create`,
    {
      method: "POST",
      headers: {
        authorization: expiryAuthorization,
        "idempotency-key": "phase0-payment-expiry",
      },
      body: { provider: "MOCK" },
    },
  );
  await prisma.paymentTransaction.update({
    where: { id: expiringPayment.body.data.id },
    data: { expiredAt: new Date(Date.now() - 1000) },
  });
  const expiredPayment = await http.request(
    `/api/payments/${expiringPayment.body.data.id}`,
    { headers: { authorization: expiryAuthorization } },
  );
  assert.equal(expiredPayment.status, 200);
  assert.equal(expiredPayment.body.data.status, "EXPIRED");
  assert.equal(
    (
      await prisma.paymentTransaction.findUniqueOrThrow({
        where: { id: expiringPayment.body.data.id },
        select: { activeKey: true },
      })
    ).activeKey,
    null,
  );

  const originalMockFlag = process.env.PAYMENT_MOCK_ENABLED;
  process.env.PAYMENT_MOCK_ENABLED = "false";
  try {
    const disabledCapabilities = await http.request(
      "/api/payments/capabilities",
      { headers: { authorization } },
    );
    assert.deepEqual(disabledCapabilities.body.data.providers, []);

    const disabledCreate = await http.request(
      `/api/payments/invoices/${invoice.id}/create`,
      {
        method: "POST",
        headers: { authorization },
        body: { provider: "MOCK" },
      },
    );
    assert.equal(disabledCreate.status, 404);
  } finally {
    process.env.PAYMENT_MOCK_ENABLED = originalMockFlag;
  }
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
    "LOOKUP_RESULT",
    "phase0-otp-concurrency",
  );
  assert.ok(sent.debugOtp);

  const attempts = await Promise.allSettled(
    Array.from({ length: 20 }, () =>
      AuthOtpService.verifyOtp(target, sent.debugOtp!, "LOOKUP_RESULT"),
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
      purpose: "LOOKUP_RESULT",
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
      (provider: { provider: string }) => provider.provider === "MOCK",
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
      body: { provider: "MOCK" },
    },
  );
  assert.equal(patientPayment.status, 201);
  assert.equal(patientPayment.body.data.provider, "MOCK");
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
      { method: "PATCH", headers: dashboardHeaders(dashboardCookie) },
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
      headers: dashboardHeaders(dashboardCookie),
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
      headers: dashboardHeaders(dashboardCookie),
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
    { method: "PATCH", headers: dashboardHeaders(dashboardCookie) },
  );
  assert.equal(issuedPrescription.status, 200);
  assert.equal(issuedPrescription.body.data.status, "ISSUED");

  const completed = await http.request(
    `/api/dashboard/appointments/${activeAppointmentId}/complete`,
    { method: "PATCH", headers: dashboardHeaders(dashboardCookie) },
  );
  assert.equal(completed.status, 200);
  assert.equal(completed.body.data.status, "COMPLETED");

  const publishedRecord = await http.request(
    `/api/dashboard/medical-records/${record.id}/publish`,
    { method: "PATCH", headers: dashboardHeaders(dashboardCookie) },
  );
  assert.equal(publishedRecord.status, 200);
  assert.equal(publishedRecord.body.data.status, "PUBLISHED");

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
  assert.deepEqual(response.body.data.payment.supportedProviders, ["MOCK"]);
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
