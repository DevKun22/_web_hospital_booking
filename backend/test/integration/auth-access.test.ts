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

  const attempt = await http.request("/api/v1/appointments", {
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

  const attempt = await http.request("/api/v1/appointments", {
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

  const rebooked = await http.request("/api/v1/appointments", {
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
  const booking = await http.request("/api/v1/appointments", {
    method: "POST",
    body: bookingBody({ phone: "0988888888" }),
  });
  assert.equal(booking.status, 201);
  const appointmentId = booking.body.data.appointmentId as string;

  const [verification, expiry] = await Promise.all([
    http.request(`/api/v1/appointments/${appointmentId}/verify-otp`, {
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

test("dashboard cookie login, refresh and logout remain compatible", async () => {
  const login = await http.request("/api/v1/auth/dashboard/login", {
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

  const verification = await http.request("/api/v1/auth/dashboard/verify-otp", {
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

  const csrfRejected = await http.request("/api/v1/auth/dashboard/refresh", {
    method: "POST",
    headers: {
      cookie: `dashboard_refresh_token=${firstRefreshToken}`,
    },
  });
  assert.equal(csrfRejected.status, 403);
  assert.equal(csrfRejected.body.code, "CSRF_VALIDATION_FAILED");

  const refresh = await http.request("/api/v1/auth/dashboard/refresh", {
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

  const logout = await http.request("/api/v1/auth/dashboard/logout", {
    method: "POST",
    headers: {
      cookie: `dashboard_refresh_token=${rotatedRefreshToken}`,
      "x-hospital-dashboard-request": "1",
    },
  });
  assert.equal(logout.status, 200);
  assert.equal(logout.body.success, true);

  const refreshAfterLogout = await http.request(
    "/api/v1/auth/dashboard/refresh",
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

  const response = await http.request("/api/v1/dashboard/appointments", {
    headers: { cookie: `dashboard_token=${legacyToken}` },
  });

  assert.equal(response.status, 401);
  assert.equal(response.body.message, "Token không hợp lệ");
});

test("dashboard authorization uses the current account state on every request", async () => {
  const staff = await prisma.user.create({
    data: {
      fullName: "Current dashboard identity",
      phone: "0900000004",
      role: "STAFF",
      isPhoneVerified: true,
    },
  });
  const cookie = await authCookie(staff.id, "STAFF");

  const appointments = () =>
    http.request("/api/v1/dashboard/appointments", {
      headers: dashboardHeaders(cookie),
    });
  const pharmacy = () =>
    http.request("/api/v1/dashboard/pharmacy/medicines", {
      headers: dashboardHeaders(cookie),
    });

  assert.equal((await appointments()).status, 200);

  await prisma.user.update({
    where: { id: staff.id },
    data: { mustChangePassword: true },
  });
  const passwordChangeRequired = await appointments();
  assert.equal(passwordChangeRequired.status, 403);
  assert.equal(passwordChangeRequired.body.code, "PASSWORD_CHANGE_REQUIRED");

  await prisma.user.update({
    where: { id: staff.id },
    data: { mustChangePassword: false, role: "PHARMACIST" },
  });
  assert.equal((await pharmacy()).status, 200);
  assert.equal((await appointments()).status, 403);

  await prisma.user.update({
    where: { id: staff.id },
    data: { isActive: false },
  });
  assert.equal((await pharmacy()).status, 401);
});

test("dashboard login limits repeated password failures by account and IP", async () => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const rejected = await http.request("/api/v1/auth/dashboard/login", {
      method: "POST",
      body: {
        phone: fixture.adminUser.phone,
        password: "incorrect-password",
      },
    });
    assert.equal(rejected.status, 401);
  }

  const limited = await http.request("/api/v1/auth/dashboard/login", {
    method: "POST",
    body: {
      phone: fixture.adminUser.phone,
      password: fixture.password,
    },
  });

  assert.equal(limited.status, 429);
  assert.equal(limited.body.code, "LOGIN_RATE_LIMITED");
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
  assert.equal((await get("/api/v1/dashboard/medical-records", staffCookie)).status, 403);
  assert.equal((await get("/api/v1/dashboard/prescriptions", staffCookie)).status, 403);
  assert.equal((await get("/api/v1/dashboard/appointments", staffCookie)).status, 200);
  assert.equal((await get("/api/v1/dashboard/invoices", staffCookie)).status, 200);

  // Quản trị mặc định không đọc nội dung y tế và không bao giờ sửa; chỉ bác sĩ ghi bệnh án và kê đơn.
  assert.equal((await get("/api/v1/dashboard/medical-records", adminCookie)).status, 403);
  assert.equal((await get("/api/v1/dashboard/prescriptions", adminCookie)).status, 403);
  assert.equal((await patch("/api/v1/dashboard/prescriptions/any-id", adminCookie)).status, 403);
  assert.equal((await patch("/api/v1/dashboard/medical-records/any-id", adminCookie)).status, 403);
  assert.equal((await get("/api/v1/dashboard/medical-records", doctorCookie)).status, 200);

  // Dược sĩ đăng nhập dashboard được và đọc đơn thuốc, nhưng không đụng bệnh án, hóa đơn.
  assert.equal((await get("/api/v1/dashboard/prescriptions", pharmacistCookie)).status, 200);
  assert.equal((await get("/api/v1/dashboard/medical-records", pharmacistCookie)).status, 403);
  assert.equal((await get("/api/v1/dashboard/invoices", pharmacistCookie)).status, 403);

  // Hoàn tiền chỉ quản trị.
  assert.equal((await patch("/api/v1/dashboard/invoices/any-id/refund", staffCookie)).status, 403);

  // Chỉ quản trị đọc ma trận.
  assert.equal((await get("/api/v1/dashboard/rbac", staffCookie)).status, 403);
  assert.equal((await get("/api/v1/dashboard/rbac", doctorCookie)).status, 403);
  const matrix = await get("/api/v1/dashboard/rbac", adminCookie);
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
    http.request("/api/v1/dashboard/rbac", {
      method: "PUT",
      headers: dashboardHeaders(adminCookie),
      body: { grants },
    });
  const staffPay = () =>
    http.request("/api/v1/dashboard/invoices/any-id/pay", {
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
    const stillManages = await http.request("/api/v1/dashboard/rbac", {
      headers: dashboardHeaders(adminCookie),
    });
    assert.equal(stillManages.status, 200);

    // Khôi phục mặc định.
    const reset = await http.request("/api/v1/dashboard/rbac", {
      method: "DELETE",
      headers: dashboardHeaders(adminCookie),
    });
    assert.equal(reset.status, 200);
    assert.notEqual((await staffPay()).status, 403);
  } finally {
    await RbacService.resetMatrix();
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

test("dashboard list endpoints support partial, case-insensitive search with q", async () => {
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");
  // Hồ sơ khám và đơn thuốc chỉ dành cho bác sĩ (quản trị không có quyền xem), nên dùng phiên bác sĩ cho hai danh sách đó.
  const doctorCookie = await authCookie(fixture.doctorOneUser.id, "DOCTOR");
  const list = async (path: string) => {
    const cookie = path.startsWith("/api/v1/dashboard/prescriptions") || path.startsWith("/api/v1/dashboard/medical-records") ? doctorCookie : adminCookie;
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
  assert.equal((await list("/api/v1/dashboard/appointments?q=qsearch")).length, 1);
  assert.equal((await list("/api/v1/dashboard/appointments?q=0944")).length, 1);
  assert.equal((await list("/api/v1/dashboard/appointments?q=khong-co-gi")).length, 0);

  // Đơn thuốc: mã đơn gõ dở hoặc mã hồ sơ gõ dở.
  assert.equal((await list("/api/v1/dashboard/prescriptions?q=rx-qsea")).length, 1);
  assert.equal((await list("/api/v1/dashboard/prescriptions?q=REC-RX")).length, 1);
  assert.equal((await list("/api/v1/dashboard/prescriptions?q=khong-co-gi")).length, 0);

  // Hồ sơ khám: mã hồ sơ gõ dở hoặc mã lịch gõ dở.
  assert.equal((await list("/api/v1/dashboard/medical-records?q=rec-rx")).length, 1);
  assert.equal((await list("/api/v1/dashboard/medical-records?q=BK-RX")).length, 1);
  assert.equal((await list("/api/v1/dashboard/medical-records?q=khong-co-gi")).length, 0);

  // Hóa đơn: mã hóa đơn gõ dở hoặc mã lịch gõ dở.
  const { invoice } = await createPayableInvoice({ bookingCode: "QINV-001", phone: "0955555555", timeSlotId: fixture.slotTwo.id });
  assert.equal((await list(`/api/v1/dashboard/invoices?q=${invoice.invoiceCode.slice(0, 8).toLowerCase()}`)).length, 1);
  assert.equal((await list("/api/v1/dashboard/invoices?q=qinv")).length, 1);
  assert.equal((await list("/api/v1/dashboard/invoices?q=khong-co-gi")).length, 0);
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

test("password reset by an admin forces a change, revokes sessions and is audited", async () => {
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");
  const target = await createDashboardUser("STAFF", "0900000101");
  const targetCookie = await authCookie(target.id, "STAFF");
  assert.equal((await dashboardCall("GET", "/api/v1/dashboard/invoices", targetCookie)).status, 200);

  const reset = await dashboardCall(
    "PATCH",
    `/api/v1/dashboard/users/${target.id}/password`,
    adminCookie,
    { password: "TempPass123" },
  );
  assert.equal(reset.status, 200);
  assert.equal(
    (await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).mustChangePassword,
    true,
  );
  // Phiên cũ của người bị đặt lại mật khẩu không còn dùng được.
  assert.equal((await dashboardCall("GET", "/api/v1/dashboard/invoices", targetCookie)).status, 401);

  const audit = await prisma.auditLog.findFirstOrThrow({
    where: { action: "USER_PASSWORD_RESET", targetId: target.id },
  });
  assert.equal(audit.actorId, fixture.adminUser.id);
  assert.equal(audit.actorRole, "ADMIN");

  // Đăng nhập lại: chỉ đổi mật khẩu được cho tới khi tự đặt mật khẩu mới.
  const freshCookie = await authCookie(target.id, "STAFF");
  const blocked = await dashboardCall("GET", "/api/v1/dashboard/invoices", freshCookie);
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.code, "PASSWORD_CHANGE_REQUIRED");
  const me = await dashboardCall("GET", "/api/v1/auth/dashboard/me", freshCookie);
  assert.equal(me.status, 200);
  assert.equal(me.body.data.mustChangePassword, true);

  const wrongCurrent = await dashboardCall("POST", "/api/v1/auth/dashboard/change-password", freshCookie, {
    currentPassword: "khong-dung",
    newPassword: "BrandNewPass1",
  });
  assert.equal(wrongCurrent.status, 400);
  const changed = await dashboardCall("POST", "/api/v1/auth/dashboard/change-password", freshCookie, {
    currentPassword: "TempPass123",
    newPassword: "BrandNewPass1",
  });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  assert.equal((await dashboardCall("GET", "/api/v1/dashboard/invoices", freshCookie)).status, 200);
  assert.equal(
    await prisma.auditLog.count({ where: { action: "PASSWORD_CHANGED", actorId: target.id } }),
    1,
  );
});

test("password reset rolls back when session revocation fails", async () => {
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");
  const target = await createDashboardUser("STAFF", "0900000103");
  const originalPasswordHash = await bcrypt.hash(fixture.password, 4);
  await prisma.user.update({
    where: { id: target.id },
    data: { password: originalPasswordHash },
  });
  const targetCookie = await authCookie(target.id, "STAFF");
  const outboxCountBefore = await prisma.outboxEvent.count();
  const triggerName = "reject_password_session_revoke_test";
  const functionName = "reject_password_session_revoke_test_fn";

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
    const reset = await dashboardCall(
      "PATCH",
      `/api/v1/dashboard/users/${target.id}/password`,
      adminCookie,
      { password: "AtomicPass123" },
    );
    assert.equal(reset.status, 500);
  } finally {
    await prisma.$executeRawUnsafe(
      `DROP TRIGGER IF EXISTS "${triggerName}" ON "${activeDatabaseSchema}"."DashboardSession"`,
    );
    await prisma.$executeRawUnsafe(
      `DROP FUNCTION IF EXISTS "${activeDatabaseSchema}"."${functionName}"()`,
    );
  }

  const stored = await prisma.user.findUniqueOrThrow({ where: { id: target.id } });
  assert.equal(await bcrypt.compare(fixture.password, stored.password || ""), true);
  assert.equal(await bcrypt.compare("AtomicPass123", stored.password || ""), false);
  assert.equal((await dashboardCall("GET", "/api/v1/dashboard/invoices", targetCookie)).status, 200);
  assert.equal(
    await prisma.auditLog.count({
      where: { action: "USER_PASSWORD_RESET", targetId: target.id },
    }),
    0,
  );
  assert.equal(await prisma.outboxEvent.count(), outboxCountBefore);
});

test("role changes revoke active sessions and write the audit atomically", async () => {
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");
  const target = await createDashboardUser("STAFF", "0900000104");
  const targetCookie = await authCookie(target.id, "STAFF");

  const changed = await dashboardCall(
    "PATCH",
    `/api/v1/dashboard/users/${target.id}`,
    adminCookie,
    { role: "PHARMACIST" },
  );
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  assert.equal(changed.body.data.role, "PHARMACIST");
  assert.equal((await dashboardCall("GET", "/api/v1/dashboard/invoices", targetCookie)).status, 401);

  const audit = await prisma.auditLog.findFirstOrThrow({
    where: { action: "USER_UPDATED", targetId: target.id },
    orderBy: { createdAt: "desc" },
  });
  assert.deepEqual(audit.meta, { roleFrom: "STAFF", roleTo: "PHARMACIST" });
});

test("concurrent role changes cannot remove every active admin", async () => {
  const [adminA, adminB] = await Promise.all([
    prisma.user.create({
      data: {
        fullName: "Concurrent Admin A",
        phone: "0900000106",
        role: "ADMIN",
        isPhoneVerified: true,
      },
    }),
    prisma.user.create({
      data: {
        fullName: "Concurrent Admin B",
        phone: "0900000107",
        role: "ADMIN",
        isPhoneVerified: true,
      },
    }),
  ]);
  const [cookieA, cookieB] = await Promise.all([
    authCookie(adminA.id, "ADMIN"),
    authCookie(adminB.id, "ADMIN"),
  ]);
  await prisma.user.update({
    where: { id: fixture.adminUser.id },
    data: { isActive: false },
  });

  const results = await Promise.all([
    dashboardCall("PATCH", `/api/v1/dashboard/users/${adminB.id}`, cookieA, { role: "STAFF" }),
    dashboardCall("PATCH", `/api/v1/dashboard/users/${adminA.id}`, cookieB, { role: "STAFF" }),
  ]);

  assert.deepEqual(
    results.map((result) => result.status).sort(),
    [200, 409],
  );
  assert.equal(
    await prisma.user.count({ where: { role: "ADMIN", isActive: true } }),
    1,
  );
});

test("the audit log is append-only and only readable by users with audit.view", async () => {
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");
  const staff = await createDashboardUser("STAFF", "0900000102");
  const staffCookie = await authCookie(staff.id, "STAFF");
  await prisma.auditLog.create({ data: { action: "USER_UPDATED", actorId: fixture.adminUser.id } });

  const listed = await dashboardCall("GET", "/api/v1/dashboard/audit-logs?limit=5", adminCookie);
  assert.equal(listed.status, 200);
  assert.ok(listed.body.data.items.length >= 1);
  assert.equal((await dashboardCall("GET", "/api/v1/dashboard/audit-logs", staffCookie)).status, 403);

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
    dashboardCall("GET", `/api/v1/dashboard/medical-records/${record.id}`, cookie);

  assert.equal((await detail(adminCookie)).status, 403);

  try {
    const granted = await dashboardCall("PUT", "/api/v1/dashboard/rbac", adminCookie, {
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

// ---- Báo cho chủ tài khoản khi người khác đổi thông tin đăng nhập -----------------
test("the account owner is warned when an admin changes their email, phone, role or password", async () => {
  const { default: EmailService } = await import("../../src/services/email.service.js");
  const { default: OutboxEventService } = await import(
    "../../src/services/outboxEvent.service.js"
  );
  const sent: Array<{ to: string; subject: string; text: string }> = [];
  const originalSend = EmailService.sendMail.bind(EmailService);
  EmailService.sendMail = async (input) => {
    sent.push({ to: input.to, subject: input.subject, text: input.text });
  };

  try {
    await prisma.outboxEvent.deleteMany();
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
      dashboardCall("PATCH", `/api/v1/dashboard/users/${staff.id}`, adminCookie, body);

    // Đổi email: thư tới email CŨ, không lộ email mới.
    const emailChange = await patch({ email: "attacker.new@example.test" });
    assert.equal(emailChange.status, 200, JSON.stringify(emailChange.body));
    assert.equal(sent.length, 0);
    assert.deepEqual(await OutboxEventService.dispatchDue(20), {
      scanned: 1,
      processed: 1,
      retrying: 0,
      failed: 0,
    });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, "owner.old@example.test");
    assert.match(sent[0].text, /Email nhận mã đăng nhập/);
    assert.ok(!sent[0].text.includes("attacker.new"));

    // Đổi số điện thoại và vai trò: thư tới email hiện tại (đã là email mới sau lần đổi trước).
    const phoneAndRole = await patch({ phone: "0900000202", role: "PHARMACIST" });
    assert.equal(phoneAndRole.status, 200, JSON.stringify(phoneAndRole.body));
    assert.equal(sent.length, 1);
    await OutboxEventService.dispatchDue(20);
    assert.equal(sent.length, 2);
    assert.equal(sent[1].to, "attacker.new@example.test");
    assert.match(sent[1].text, /Số điện thoại đăng nhập/);
    assert.match(sent[1].text, /Vai trò/);

    // Đặt lại mật khẩu: có thư, và thư không chứa mật khẩu.
    const reset = await dashboardCall(
      "PATCH",
      `/api/v1/dashboard/users/${staff.id}/password`,
      adminCookie,
      { password: "SecretTemp99" },
    );
    assert.equal(reset.status, 200);
    assert.equal(sent.length, 2);
    await OutboxEventService.dispatchDue(20);
    assert.equal(sent.length, 3);
    assert.match(sent[2].text, /Mật khẩu tài khoản đã được quản trị đặt lại/);
    assert.ok(!sent[2].text.includes("SecretTemp99"));

    // Đổi tên (không ảnh hưởng đăng nhập) thì không gửi thư.
    assert.equal((await patch({ fullName: "Renamed Staff" })).status, 200);
    assert.equal(sent.length, 3);

    // Tự sửa tài khoản của chính mình thì không cần cảnh báo.
    const selfEdit = await dashboardCall(
      "PATCH",
      `/api/v1/dashboard/users/${fixture.adminUser.id}`,
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
    const failedDispatch = await OutboxEventService.dispatchDue(20);
    assert.equal(failedDispatch.retrying, 1);
    const retryingEvent = await prisma.outboxEvent.findFirstOrThrow({
      where: { status: "PENDING", attempts: 1 },
      orderBy: { createdAt: "desc" },
    });
    assert.match(retryingEvent.lastError || "", /mail provider down/);
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
      return fetch(`${http.baseUrl}/api/v1/uploads/medical-files`, {
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
      dashboardCall("PATCH", `/api/v1/dashboard/medical-records/${record.id}`, doctorCookie, { resultPdfUrl: url });
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
    const cleanup = await dashboardCall("POST", "/api/v1/uploads/images/cleanup-unused", adminCookie, {
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
    assert.deepEqual(Buffer.from(await file.arrayBuffer()), pdfBytes);
    assert.equal(requested.length, 1);
    assert.match(requested[0], /\/raw\/authenticated\/s--[^/]+--\/v1700000000\//);

    // Bác sĩ mở tệp trong dashboard cũng qua máy chủ (đường dẫn gốc của tệp riêng tư không mở được):
    // đúng loại tệp, đường dẫn được ký; bác sĩ khác (ngoài phạm vi) hoặc không có quyền thì từ chối.
    const dashboardFile = await fetch(`${http.baseUrl}/api/v1/dashboard/medical-records/${record.id}/file`, {
      headers: dashboardHeaders(doctorCookie),
    });
    assert.equal(dashboardFile.status, 200);
    assert.equal(dashboardFile.headers.get("content-type"), "application/pdf");
    assert.equal(dashboardFile.headers.get("cache-control"), "private, no-store, max-age=0");
    assert.deepEqual(Buffer.from(await dashboardFile.arrayBuffer()), pdfBytes);
    assert.equal(requested.length, 2);
    assert.match(requested[1], /\/raw\/authenticated\/s--[^/]+--\/v1700000000\//);
    const otherDoctorCookie = await authCookie(fixture.doctorTwoUser.id, "DOCTOR");
    const otherDoctorFile = await fetch(`${http.baseUrl}/api/v1/dashboard/medical-records/${record.id}/file`, {
      headers: dashboardHeaders(otherDoctorCookie),
    });
    assert.equal(otherDoctorFile.status, 404);
    const staffFile = await fetch(`${http.baseUrl}/api/v1/dashboard/medical-records/${record.id}/file`, {
      headers: dashboardHeaders(staffCookie),
    });
    assert.equal(staffFile.status, 403);
  } finally {
    uploader.upload_stream = originalUpload;
    uploader.destroy = originalDestroy;
    globalThis.fetch = originalFetch;
  }
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
    http.request("/api/v1/dashboard/notifications", {
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
  const doctorInbox = await get("/api/v1/dashboard/inbox", doctorCookie);
  assert.equal(doctorInbox.status, 200);
  assert.equal(doctorInbox.body.data.items.length, 1);
  assert.equal(doctorInbox.body.data.items[0].title, "Họp khoa sáng mai");
  assert.equal(doctorInbox.body.data.meta.unreadCount, 1);
  assert.equal((await get("/api/v1/dashboard/inbox", staffCookie)).body.data.items.length, 0);
  assert.equal((await get("/api/v1/dashboard/inbox", pharmacistCookie)).body.data.items.length, 0);

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
  assert.equal((await get("/api/v1/dashboard/inbox/unread-count", pharmacistCookie)).body.data.unreadCount, 1);

  // Đánh dấu đã đọc: chỉ trong hộp thư của chính mình.
  const itemId = doctorInbox.body.data.items[0].id;
  const foreign = await http.request(`/api/v1/dashboard/inbox/${itemId}/read`, {
    method: "PATCH",
    headers: dashboardHeaders(staffCookie),
  });
  assert.equal(foreign.status, 404);
  const read = await http.request(`/api/v1/dashboard/inbox/${itemId}/read`, {
    method: "PATCH",
    headers: dashboardHeaders(doctorCookie),
  });
  assert.equal(read.status, 200);
  assert.equal((await get("/api/v1/dashboard/inbox/unread-count", doctorCookie)).body.data.unreadCount, 0);

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
  const doctorEvents = await get("/api/v1/dashboard/inbox", doctorCookie);
  assert.ok(doctorEvents.body.data.items.some((item: { type: string }) => item.type === "APPOINTMENT_CREATED"));
  const staffEvents = await get("/api/v1/dashboard/inbox", staffCookie);
  assert.equal(staffEvents.body.data.items.length, 1);
  assert.equal(staffEvents.body.data.items[0].entityType, "APPOINTMENT");

  // Gọi lại cùng sự kiện không tạo bản ghi trùng.
  await StaffNotificationService.notifyAppointmentEvent(appointment.id, "CREATED", {
    includeReception: true,
  });
  assert.equal((await get("/api/v1/dashboard/inbox", staffCookie)).body.data.items.length, 1);

  // Người tự xác nhận lịch của mình không nhận thông báo về chính thao tác đó.
  await StaffNotificationService.notifyAppointmentEvent(appointment.id, "CONFIRMED", {
    actorId: fixture.doctorOneUser.id,
  });
  const afterSelf = await get("/api/v1/dashboard/inbox", doctorCookie);
  assert.ok(!afterSelf.body.data.items.some((item: { type: string }) => item.type === "APPOINTMENT_CONFIRMED"));
});
