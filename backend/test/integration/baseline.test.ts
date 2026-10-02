import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { getCookie, startHttpServer } from "../support/http.js";
import { UNMARKED_TEST_DATABASE_CONFIRMATION } from "../support/testDatabase.js";

if (process.env.NODE_ENV !== "test") {
  throw new Error("Integration tests require NODE_ENV=test.");
}

const activeDatabaseUrl = process.env.DATABASE_URL || "";
const activeDatabase = new URL(activeDatabaseUrl);
const activeDatabaseMarker =
  `${activeDatabase.pathname} ${activeDatabase.searchParams.get("schema") || ""}`.toLowerCase();
const hasDestructiveConfirmation =
  process.env.TEST_DATABASE_DESTRUCTIVE_OK ===
  UNMARKED_TEST_DATABASE_CONFIRMATION;

if (!activeDatabaseMarker.includes("test") && !hasDestructiveConfirmation) {
  throw new Error(
    "Refusing to run destructive integration tests outside a test database/schema.",
  );
}

const [
  { createApp },
  { prisma },
  { generateToken },
  { default: AuthOtpService },
  { default: AppointmentService },
  { signLookupGrant },
  { default: ScheduleReconciliationService },
  { default: AuthSessionService },
] = await Promise.all([
  import("../../src/app.js"),
  import("../../src/config/prisma.js"),
  import("../../src/utils/jwt.js"),
  import("../../src/services/authOtp.service.js"),
  import("../../src/services/appointment.service.js"),
  import("../../src/utils/lookupGrant.js"),
  import("../../src/services/scheduleReconciliation.service.js"),
  import("../../src/services/authSession.service.js"),
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
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "OtpSecurityBlock", "OtpVerifyAttempt", "User", "Department" RESTART IDENTITY CASCADE',
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

  const doctorOneUser = await prisma.user.create({
    data: {
      fullName: "Doctor One",
      phone: "0900000001",
      password: passwordHash,
      role: "DOCTOR",
      isPhoneVerified: true,
    },
  });
  const doctorTwoUser = await prisma.user.create({
    data: {
      fullName: "Doctor Two",
      phone: "0900000002",
      password: passwordHash,
      role: "DOCTOR",
      isPhoneVerified: true,
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

  const doctorOne = await prisma.doctorProfile.create({
    data: {
      userId: doctorOneUser.id,
      departmentId: department.id,
      consultationFee: 300000,
    },
  });
  const doctorTwo = await prisma.doctorProfile.create({
    data: {
      userId: doctorTwoUser.id,
      departmentId: department.id,
      consultationFee: 350000,
    },
  });

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

  await prisma.doctorTimeSlot.update({
    where: { id: fixture.slotTwo.id },
    data: { status: "BOOKED" },
  });

  return prisma.appointment.create({
    data: {
      bookingCode,
      appointmentDate: dateOnly(fixture.appointmentDate),
      startTime: fixture.slotTwo.startTime,
      endTime: fixture.slotTwo.endTime,
      status: input.status,
      patientName: patient.fullName,
      patientPhone: phone,
      patientId: patient.id,
      doctorId: fixture.doctorOne.id,
      departmentId: fixture.department.id,
      timeSlotId: fixture.slotTwo.id,
      estimatedPrice: 300000,
      finalAmount: 300000,
    },
  });
};

const authCookie = (userId: string, role: "ADMIN" | "DOCTOR") => {
  const token = generateToken({ userId, role });
  return `dashboard_token=${token}`;
};

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

before(async () => {
  http = await startHttpServer(
    createApp({ requestLogging: false, slowRequestLogging: false }),
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
  const booking = await http.request("/api/appointments", {
    method: "POST",
    body: bookingBody({ phone: "0912345678" }),
  });

  const verification = await http.request(
    `/api/appointments/${booking.body.data.appointmentId}/verify-otp`,
    {
      method: "POST",
      body: { otp: booking.body.data.debugOtp },
    },
  );

  assert.equal(verification.status, 200);
  assert.equal(verification.body.success, true);
  assert.equal(verification.body.data.status, "PENDING_CONFIRM");
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
  const cookie = authCookie(fixture.doctorTwoUser.id, "DOCTOR");

  const read = await http.request(
    `/api/dashboard/appointments/${appointment.id}`,
    { headers: { cookie } },
  );
  const transition = await http.request(
    `/api/dashboard/appointments/${appointment.id}/start`,
    { method: "PATCH", headers: { cookie } },
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
  const cookie = authCookie(fixture.adminUser.id, "ADMIN");
  const endpoint = `/api/dashboard/appointments/${appointment.id}`;

  const [start, noShow] = await Promise.all([
    http.request(`${endpoint}/start`, {
      method: "PATCH",
      headers: { cookie },
    }),
    http.request(`${endpoint}/no-show`, {
      method: "PATCH",
      headers: { cookie },
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
  const cookie = authCookie(fixture.adminUser.id, "ADMIN");
  const endpoint = `/api/dashboard/appointments/${appointment.id}/start`;

  const responses = await Promise.all([
    http.request(endpoint, { method: "PATCH", headers: { cookie } }),
    http.request(endpoint, { method: "PATCH", headers: { cookie } }),
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

  const refresh = await http.request("/api/auth/dashboard/refresh", {
    method: "POST",
    headers: {
      cookie: `dashboard_refresh_token=${firstRefreshToken}`,
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
      },
    },
  );
  assert.equal(refreshAfterLogout.status, 401);
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
  const cookie = authCookie(fixture.adminUser.id, "ADMIN");
  const endpoint = `/api/dashboard/invoices/appointments/${appointment.id}`;

  const rejected = await http.request(endpoint, {
    method: "POST",
    headers: { cookie },
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
    headers: { cookie },
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
  assert.equal(appointments.body.meta.limit, 50);
  assert.equal(appointments.body.meta.hasPreviousPage, false);

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

  const crossPatient = await http.request(
    `/api/v1/me/medical-records/${otherRecord.id}`,
    { headers: { authorization } },
  );
  assert.equal(crossPatient.status, 404);

  const unauthenticated = await http.request("/api/v1/me/appointments");
  assert.equal(unauthenticated.status, 401);
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

test("v1 capabilities formally exclude online payment from the patient MVP", async () => {
  const response = await http.request("/api/v1/capabilities");
  assert.equal(response.status, 200);
  assert.equal(response.body.data.payment.enabled, false);
  assert.equal(
    response.body.data.payment.reason,
    "PAYMENT_EXCLUDED_FROM_PATIENT_MVP",
  );
  assert.deepEqual(response.body.data.payment.supportedProviders, []);
});
