import { MaintenanceService, assert, bookingBody, dateOnly, emailOf, fixture, http, prisma, test } from "./support/context.js";

// Đặt lịch bằng email: thông báo trung tính cho email không dùng được, giữ chỗ lặp không báo lỗi, trần lịch đang chờ OTP, dọn tài khoản rác.

const NEUTRAL_CODE = "EMAIL_UNAVAILABLE";

const book = (phone: string, extra: { timeSlotId?: string; email?: string } = {}) =>
  http.request("/api/v1/appointments", { method: "POST", body: bookingBody({ phone, ...extra }) });

const extraSlot = (startTime: string) =>
  prisma.doctorTimeSlot.create({
    data: {
      doctorId: fixture.doctorOne.id,
      date: dateOnly(new Date(fixture.slotOne.date).toISOString().slice(0, 10)),
      startTime,
      endTime: startTime.slice(0, 2) + ":30",
    },
  });

test("an unusable email gets one neutral answer that never reveals why", async () => {
  const staffBooking = await book("0955900001", { email: fixture.adminUser.email });
  assert.equal(staffBooking.status, 409);
  assert.equal(staffBooking.body.code, NEUTRAL_CODE);
  const message = String(staffBooking.body.message);
  assert.ok(!/nội bộ|nhân sự|quản trị|khóa|staff|admin/i.test(message), message);

  // Đăng nhập người khám: email nhân sự và tài khoản bị khóa được trả lời y hệt email thường, không gửi mã, không xác thực được.
  const locked = await prisma.user.create({
    data: { fullName: "Bị khóa", email: "locked.patient@example.test", role: "PATIENT", isActive: false, isEmailVerified: true },
  });
  const normal = await http.request("/api/v1/auth/patient/request-otp", { method: "POST", body: { email: "fresh.patient@example.test" } });
  const staffLogin = await http.request("/api/v1/auth/patient/request-otp", { method: "POST", body: { email: fixture.adminUser.email } });
  const lockedLogin = await http.request("/api/v1/auth/patient/request-otp", { method: "POST", body: { email: locked.email } });
  for (const response of [normal, staffLogin, lockedLogin]) {
    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.ok(response.body.data.challengeId);
    assert.equal(response.body.data.expiresIn, normal.body.data.expiresIn);
    const shape = (body: unknown) => Object.keys((body as { data: object }).data).filter((key) => key !== "debugOtp").sort();
    assert.deepEqual(shape(response.body), shape(normal.body));
  }
  assert.equal(staffLogin.body.data.debugOtp, undefined);
  // Không có email thật nào được xếp hàng cho email nhân sự hoặc tài khoản khóa.
  assert.equal(await prisma.otpCode.count({ where: { email: fixture.adminUser.email, usedAt: null } }), 0);
  assert.equal(await prisma.otpCode.count({ where: { email: locked.email, usedAt: null } }), 0);

  // Nhập mã bất kỳ: cùng câu trả lời như nhập sai mã của email thường.
  const wrongNormal = await http.request("/api/v1/auth/patient/verify-otp", { method: "POST", body: { challengeId: normal.body.data.challengeId, otp: "000000" } });
  const wrongStaff = await http.request("/api/v1/auth/patient/verify-otp", { method: "POST", body: { challengeId: staffLogin.body.data.challengeId, otp: "000000" } });
  assert.equal(wrongStaff.status, wrongNormal.status);
  assert.equal(wrongStaff.body.message, wrongNormal.body.message);

  // Gửi lại ngay cũng bị chặn thời gian chờ như email thường.
  const again = await http.request("/api/v1/auth/patient/request-otp", { method: "POST", body: { email: fixture.adminUser.email } });
  assert.equal(again.status, 429);
  assert.equal(again.body.code, "OTP_COOLDOWN");
});

test("sending the same booking twice returns the same hold instead of a 'slot unavailable' error", async () => {
  const first = await book("0955900002");
  assert.equal(first.status, 201);
  assert.equal(first.body.data.otpRequired, true);

  const second = await book("0955900002");
  assert.equal(second.status, 201, JSON.stringify(second.body));
  assert.equal(second.body.data.appointmentId, first.body.data.appointmentId);
  assert.equal(second.body.data.bookingCode, first.body.data.bookingCode);
  assert.equal(second.body.data.resumed, true);
  assert.equal(second.body.data.debugOtp, undefined, "a repeat must not send or reveal a second OTP");
  assert.equal(await prisma.appointment.count(), 1);
  assert.equal(await prisma.otpCode.count({ where: { purpose: "BOOK_APPOINTMENT" } }), 1);

  // Người khác (email khác) vẫn không giữ được khung giờ đang bị giữ.
  const other = await book("0955900003");
  assert.equal(other.status, 409);

  // Giữ chỗ lặp vẫn xác thực được bằng mã của lần đầu.
  const verification = await http.request(`/api/v1/appointments/${first.body.data.appointmentId}/verify-otp`, {
    method: "POST",
    body: { otp: first.body.data.debugOtp },
  });
  assert.equal(verification.status, 200);
});

test("one email can hold at most two slots awaiting OTP, and verifying frees the budget", async () => {
  const slotThree = await extraSlot("11:00");
  const slotFour = await extraSlot("12:00");

  // OTP cùng một email có thời gian chờ 60 giây giữa hai lần gửi; lùi mốc gửi để thử trần số lịch chờ chứ không phải thời gian chờ.
  const skipOtpCooldown = () => prisma.otpCode.updateMany({ data: { createdAt: new Date(Date.now() - 5 * 60_000) } });
  const first = await book("0955900004");
  await skipOtpCooldown();
  const second = await book("0955900004", { timeSlotId: fixture.slotTwo.id });
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);

  const third = await book("0955900004", { timeSlotId: slotThree.id });
  assert.equal(third.status, 409);
  assert.equal(third.body.code, "TOO_MANY_OPEN_HOLDS");
  assert.equal((await prisma.doctorTimeSlot.findUniqueOrThrow({ where: { id: slotThree.id } })).status, "AVAILABLE");

  // Xác thực một lịch thì được đặt thêm.
  const verified = await http.request(`/api/v1/appointments/${first.body.data.appointmentId}/verify-otp`, {
    method: "POST",
    body: { otp: first.body.data.debugOtp },
  });
  assert.equal(verified.status, 200);
  await skipOtpCooldown();
  const fourth = await book("0955900004", { timeSlotId: slotFour.id });
  assert.equal(fourth.status, 201, JSON.stringify(fourth.body));
});

test("never-verified patient accounts are cleaned up, but accounts with data or recent ones are kept", async () => {
  const old = new Date(Date.now() - 30 * 86_400_000);
  const make = (email: string, extra: Record<string, unknown> = {}) =>
    prisma.user.create({ data: { fullName: "Người khám", email, role: "PATIENT", createdAt: old, ...extra } });
  const junk = await make("junk.old@example.test");
  const verified = await make("verified.old@example.test", { isEmailVerified: true });
  const withAppointment = await make("with.appointment@example.test");
  await prisma.appointment.create({
    data: {
      bookingCode: "CLEAN-1",
      appointmentDate: dateOnly(new Date(fixture.slotOne.date).toISOString().slice(0, 10)),
      startTime: "13:00",
      endTime: "13:30",
      status: "CANCELLED_BY_PATIENT",
      patientName: "x",
      patientPhone: "0900000000",
      patientEmail: withAppointment.email,
      patientId: withAppointment.id,
      doctorId: fixture.doctorOne.id,
      departmentId: fixture.department.id,
    },
  });
  const recent = await prisma.user.create({ data: { fullName: "Mới", email: emailOf("0955900009"), role: "PATIENT" } });
  // Có một lượt đăng nhập đang dở: thử thách đi theo tài khoản bị xóa.
  await prisma.dashboardLoginChallenge.create({ data: { userId: junk.id, purpose: "PATIENT_PORTAL_LOGIN", expiresAt: old } });

  const result = await MaintenanceService.cleanupUnverifiedPatients();
  assert.equal(result.deleted, 1);
  assert.equal(await prisma.user.count({ where: { id: junk.id } }), 0);
  for (const kept of [verified, withAppointment, recent]) {
    assert.equal(await prisma.user.count({ where: { id: kept.id } }), 1, kept.email);
  }
});

test("a second booking inside the OTP cooldown is refused with the exact wait and releases its slot", async () => {
  const first = await book("0955900010");
  assert.equal(first.status, 201);

  const tooSoon = await book("0955900010", { timeSlotId: fixture.slotTwo.id });
  assert.equal(tooSoon.status, 429);
  assert.equal(tooSoon.body.code, "OTP_COOLDOWN");
  assert.ok(tooSoon.body.retryAfterSeconds > 0 && tooSoon.body.retryAfterSeconds <= 60, JSON.stringify(tooSoon.body));
  // Lỗi gửi OTP không để lại lịch giữ chỗ ma.
  assert.equal((await prisma.doctorTimeSlot.findUniqueOrThrow({ where: { id: fixture.slotTwo.id } })).status, "AVAILABLE");
  assert.equal(await prisma.appointment.count({ where: { patientEmail: emailOf("0955900010") } }), 1);
});
