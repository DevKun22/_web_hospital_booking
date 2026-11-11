import {
  AppointmentService,
  AuthOtpService,
  AuthSessionService,
  InvoiceService,
  MedicalRecordService,
  NotificationService,
  PolicyService,
  PrescriptionService,
  RbacService,
  ScheduleReconciliationService,
  activeDatabase,
  activeDatabaseMarker,
  activeDatabaseSchema,
  activeDatabaseUrl,
  after,
  assert,
  authCookie,
  bcrypt,
  before,
  beforeEach,
  bookingBody,
  buildVnpayCallbackQuery,
  buildVnpayQueryResponse,
  buildVnpayRefundResponse,
  callVnpayRefund,
  createApp,
  createDashboardUser,
  createIssuedPrescription,
  createMedicineViaApi,
  createPayableInvoice,
  createStoredAppointment,
  createVnpayPaidInvoice,
  createVnpayPayment,
  dashboardCall,
  dashboardHeaders,
  dateOnly,
  emailBookingBody,
  fixture,
  futureDate,
  generateDashboardAccessToken,
  generatePatientAccessToken,
  getCookie,
  http,
  isFirebaseAdminConfigured,
  isoDateFromToday,
  jwt,
  loginPatient,
  moveAppointmentStart,
  prisma,
  receiveViaApi,
  resetDatabase,
  seedFixture,
  startHttpServer,
  test,
  vietnamClock,
  vnpayIpn,
  withStubbedVnpayQuery,
  withStubbedVnpayRefund,
} from "./support/context.js";

test("readiness checks the dedicated PostgreSQL database", async () => {
  const health = await http.request("/health");
  const ready = await http.request("/ready");

  assert.equal(health.status, 200);
  assert.equal(health.body.status, "ok");
  assert.equal(ready.status, 200);
  assert.equal(ready.body.status, "ready");
  assert.deepEqual(ready.body.checks, {
    database: "up",
    redis: "not_configured",
    queueRedis: "not_configured",
  });
});

test("v1 is the only API namespace for public content", async () => {
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
    const v1Response = await http.request(`/api/v1/${endpoint}`);
    const legacyResponse = await http.request(`/api/${endpoint}`);

    assert.equal(legacyResponse.status, 404, `legacy ${endpoint}`);
    assert.equal(v1Response.status, 200, `v1 ${endpoint}`);
    assert.match(
      v1Response.headers.get("server-timing") || "",
      /^app;dur=\d+(?:\.\d+)?, db;dur=\d+(?:\.\d+)?$/,
    );
    if (endpoint === "departments") {
      assert.ok(
        Number(v1Response.headers.get("x-database-query-count")) > 0,
        "department request should report at least one database query",
      );
    }
  }
});

test("public catalogs paginate, filter and preserve compact arrays", async () => {
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

  const compactDoctors = await http.request("/api/v1/doctors?limit=1");
  const compactPackages = await http.request("/api/v1/packages?limit=1");
  assert.ok(Array.isArray(compactDoctors.body.data));
  assert.ok(Array.isArray(compactPackages.body.data));
  assert.equal(compactDoctors.body.data.length, 1);
  assert.equal(compactPackages.body.data.length, 1);
});

test("one slot can be booked only once", async () => {
  const first = await http.request("/api/v1/appointments", {
    method: "POST",
    body: bookingBody({ phone: "0912345678" }),
  });
  const second = await http.request("/api/v1/appointments", {
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

  const booking = await http.request("/api/v1/appointments", {
    method: "POST",
    body: bookingBody({ phone: existingPatient.phone! }),
  });
  assert.equal(booking.status, 201);

  const verification = await http.request(
    `/api/v1/appointments/${booking.body.data.appointmentId}/verify-otp`,
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

  const booking = await http.request("/api/v1/appointments", {
    method: "POST",
    body: {
      ...bookingBody({ phone: "0977777777" }),
      patientEmail: "owned@example.com",
      cccd: "012345678901",
    },
  });
  assert.equal(booking.status, 201);

  const verification = await http.request(
    `/api/v1/appointments/${booking.body.data.appointmentId}/verify-otp`,
    { method: "POST", body: { otp: booking.body.data.debugOtp } },
  );
  assert.equal(verification.status, 409);

  const pending = await prisma.appointment.findUniqueOrThrow({
    where: { id: booking.body.data.appointmentId },
    select: { status: true },
  });
  assert.equal(pending.status, "PENDING_OTP");
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

  const booking = await http.request("/api/v1/appointments", {
    method: "POST",
    body: emailBookingBody({
      phone: owner.phone!,
      email: "Registered-Owner@Example.com",
    }),
  });
  assert.equal(booking.status, 201);
  assert.equal(typeof booking.body.data.debugOtp, "string");

  const verification = await http.request(
    `/api/v1/appointments/${booking.body.data.appointmentId}/verify-otp`,
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
  const booking = await http.request("/api/v1/appointments", {
    method: "POST",
    body: emailBookingBody({
      phone: "0944444444",
      email: "first-claim@example.com",
    }),
  });
  assert.equal(booking.status, 201);

  const verification = await http.request(
    `/api/v1/appointments/${booking.body.data.appointmentId}/verify-otp`,
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
  const first = await http.request("/api/v1/appointments", {
    method: "POST",
    body: emailBookingBody({
      phone: "0944444445",
      email: "claim-one@example.com",
      timeSlotId: fixture.slotOne.id,
    }),
  });
  const second = await http.request("/api/v1/appointments", {
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
    `/api/v1/appointments/${first.body.data.appointmentId}/verify-otp`,
    { method: "POST", body: { otp: first.body.data.debugOtp } },
  );
  assert.equal(firstVerified.status, 200);

  const secondVerified = await http.request(
    `/api/v1/appointments/${second.body.data.appointmentId}/verify-otp`,
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

test("public booking uses the conservative phone limit while Redis is degraded", async () => {
  // The limiter is off in the test environment so the suite can call the API in
  // bulk; this test turns it on for its own requests only.
  process.env.RATE_LIMIT_ENABLED = "true";
  try {
    const responses = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      responses.push(
        await http.request("/api/v1/appointments", {
          method: "POST",
          body: bookingBody({ phone: "0933333333" }),
        }),
      );
    }

    assert.ok(responses.slice(0, 3).every((item) => item.status !== 429));

    const limited = responses[3];
    assert.equal(limited.status, 429);
    assert.equal(limited.body.code, "RATE_LIMITED");
    assert.ok(Number(limited.headers.get("retry-after")) > 0);
  } finally {
    delete process.env.RATE_LIMIT_ENABLED;
  }
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

test("a doctor cannot read or transition another doctor's appointment", async () => {
  const appointment = await createStoredAppointment({ status: "CHECKED_IN" });
  const cookie = await authCookie(fixture.doctorTwoUser.id, "DOCTOR");

  const read = await http.request(
    `/api/v1/dashboard/appointments/${appointment.id}`,
    { headers: dashboardHeaders(cookie) },
  );
  const transition = await http.request(
    `/api/v1/dashboard/appointments/${appointment.id}/start`,
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
  const endpoint = `/api/v1/dashboard/appointments/${appointment.id}`;

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
  const endpoint = `/api/v1/dashboard/appointments/${appointment.id}/start`;

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
      await http.request(`/api/v1/dashboard/appointments/${appointment.id}`, {
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

test("v1 API responses keep the success/message/data envelope", async () => {
  const response = await http.request("/api/v1/appointments", {
    method: "POST",
    body: bookingBody({ phone: "0912345678" }),
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.success, true);
  assert.equal(typeof response.body.message, "string");
  assert.equal(typeof response.body.data, "object");
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

test("status changes roll back when session revocation fails", async () => {
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");
  const target = await createDashboardUser("STAFF", "0900000105");
  const targetCookie = await authCookie(target.id, "STAFF");
  const triggerName = "reject_status_session_revoke_test";
  const functionName = "reject_status_session_revoke_test_fn";

  assert.match(target.id, /^[0-9a-f-]+$/i);
  await prisma.$executeRawUnsafe(
    `CREATE OR REPLACE FUNCTION "${activeDatabaseSchema}"."${functionName}"()
     RETURNS trigger LANGUAGE plpgsql AS $$
     BEGIN
       IF OLD."userId" = TG_ARGV[0]
          AND OLD."revokedAt" IS NULL
          AND NEW."revokedAt" IS NOT NULL THEN
         RAISE EXCEPTION 'forced session revoke failure';
       END IF;
       RETURN NEW;
     END;
     $$`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE TRIGGER "${triggerName}"
     BEFORE UPDATE ON "${activeDatabaseSchema}"."DashboardSession"
     FOR EACH ROW EXECUTE FUNCTION "${activeDatabaseSchema}"."${functionName}"('${target.id}')`,
  );

  try {
    const changed = await dashboardCall(
      "PATCH",
      `/api/v1/dashboard/users/${target.id}/status`,
      adminCookie,
      { isActive: false },
    );
    assert.equal(changed.status, 500);
  } finally {
    await prisma.$executeRawUnsafe(
      `DROP TRIGGER IF EXISTS "${triggerName}" ON "${activeDatabaseSchema}"."DashboardSession"`,
    );
    await prisma.$executeRawUnsafe(
      `DROP FUNCTION IF EXISTS "${activeDatabaseSchema}"."${functionName}"()`,
    );
  }

  assert.equal(
    (await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).isActive,
    true,
  );
  assert.equal((await dashboardCall("GET", "/api/v1/dashboard/invoices", targetCookie)).status, 200);
  assert.equal(
    await prisma.auditLog.count({
      where: { action: "USER_STATUS_CHANGED", targetId: target.id },
    }),
    0,
  );
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
  const staffInbox = await http.request("/api/v1/dashboard/inbox", { headers: dashboardHeaders(staffCookie) });
  assert.ok(staffInbox.body.data.items.some((item: { title: string }) => item.title.includes("cần xử lý")));

  // Đóng lịch theo khoảng ngày: khóa khung giờ trống; bác sĩ khác không được thao tác.
  const from = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const closed = await post("/api/v1/dashboard/doctor-time-slots/close-range", doctorCookie, {
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
  const outsider = await post("/api/v1/dashboard/doctor-time-slots/close-range", await authCookie(fixture.doctorTwoUser.id, "DOCTOR"), {
    doctorId: fixture.doctorOne.id,
    from,
    to,
    reason: "Nghỉ phép",
  });
  assert.equal(outsider.status, 403);

  const reopened = await post("/api/v1/dashboard/doctor-time-slots/reopen-range", adminCookie, {
    doctorId: fixture.doctorOne.id,
    from,
    to,
  });
  assert.equal(reopened.status, 200);
  assert.equal(reopened.body.data.reopenedSlots, closed.body.data.lockedSlots);
});
