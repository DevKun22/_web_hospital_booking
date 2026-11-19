import { PolicyService, assert, bookingBody, dateOnly, emailOf, fixture, futureDate, http, loginPatient, prisma, test } from "./support/context.js";

// Giới hạn đặt lịch theo kịch bản: trần lịch sắp tới, chống trùng bác sĩ/giờ, người thân, hủy liên tục, đặt đồng thời, dò email.

type Auth = Awaited<ReturnType<typeof loginPatient>>;

const asPatient = async (phone: string) => {
  const auth: Auth = await loginPatient(phone);
  return { auth, authorization: `Bearer ${auth.accessToken}`, email: emailOf(phone), phone };
};

const slotOn = (doctorId: string, date: string, startTime: string, endTime: string) =>
  prisma.doctorTimeSlot.create({ data: { doctorId, date: dateOnly(date), startTime, endTime } });

// Lịch có sẵn của một tài khoản (dựng thẳng trong cơ sở dữ liệu để các ca không phụ thuộc vào luồng đặt).
const seed = (
  patient: { auth: Auth; email: string; phone: string },
  input: {
    date: string;
    startTime?: string;
    endTime?: string;
    status?: "PENDING_CONFIRM" | "CONFIRMED" | "CANCELLED_BY_PATIENT" | "COMPLETED";
    doctorId?: string;
    dependentProfileId?: string;
    confirmedAt?: Date | null;
    cancelledAt?: Date | null;
  },
) =>
  prisma.appointment.create({
    data: {
      bookingCode: `LIM-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      appointmentDate: dateOnly(input.date),
      startTime: input.startTime ?? "08:00",
      endTime: input.endTime ?? "08:30",
      status: input.status ?? "CONFIRMED",
      patientName: "Có sẵn",
      patientPhone: patient.phone,
      patientEmail: patient.email,
      patientInfo: { create: {} },
      patientId: patient.auth.user.id,
      dependentProfileId: input.dependentProfileId,
      doctorId: input.doctorId ?? fixture.doctorOne.id,
      departmentId: fixture.department.id,
      confirmedAt: input.confirmedAt === undefined ? new Date() : input.confirmedAt,
      cancelledAt: input.cancelledAt ?? null,
      estimatedPrice: 1,
      finalAmount: 1,
    },
  });

// Đặt khi đã đăng nhập (tự xác nhận, không qua OTP): đường mà trước đây không bị trần nào.
const bookAs = (patient: { authorization: string; email: string; phone: string }, timeSlotId: string, extra: Record<string, unknown> = {}, doctorId?: string) =>
  http.request("/api/v1/appointments", {
    method: "POST",
    headers: { authorization: patient.authorization },
    body: { ...bookingBody({ phone: patient.phone, email: patient.email, timeSlotId, doctorId }), ...extra },
  });

const distinctDates = (count: number, from = 20) => Array.from({ length: count }, (_, index) => futureDate(from + index));

test("an account is capped on upcoming appointments, on both the logged-in and the OTP path", async () => {
  const patient = await asPatient("0955700001");
  for (const date of distinctDates(5)) await seed(patient, { date });

  const target = await slotOn(fixture.doctorOne.id, futureDate(40), "09:00", "09:30");
  const loggedIn = await bookAs(patient, target.id);
  assert.equal(loggedIn.status, 409, JSON.stringify(loggedIn.body));
  assert.equal(loggedIn.body.code, "ACTIVE_LIMIT");

  const guest = await http.request("/api/v1/appointments", { method: "POST", body: bookingBody({ phone: patient.phone, email: patient.email, timeSlotId: target.id }) });
  assert.equal(guest.status, 409);
  assert.equal(guest.body.code, "ACTIVE_LIMIT");
  // Lịch bị từ chối không giữ lại khung giờ.
  assert.equal((await prisma.doctorTimeSlot.findUniqueOrThrow({ where: { id: target.id } })).status, "AVAILABLE");
});

test("cancelled, completed and past appointments do not count toward the cap", async () => {
  const patient = await asPatient("0955700002");
  const dates = distinctDates(5);
  await seed(patient, { date: dates[0], status: "CANCELLED_BY_PATIENT", cancelledAt: new Date() });
  await seed(patient, { date: dates[1], status: "COMPLETED" });
  await seed(patient, { date: futureDate(-3), status: "CONFIRMED" });
  await seed(patient, { date: dates[3] });
  await seed(patient, { date: dates[4] });

  const target = await slotOn(fixture.doctorOne.id, futureDate(40), "09:00", "09:30");
  const result = await bookAs(patient, target.id);
  assert.equal(result.status, 201, JSON.stringify(result.body));
});

test("the cap follows the dashboard policy", async () => {
  const patient = await asPatient("0955700003");
  await seed(patient, { date: futureDate(20) });
  try {
    await PolicyService.update({ maxActiveAppointments: 1 });
    const target = await slotOn(fixture.doctorOne.id, futureDate(40), "09:00", "09:30");
    const blocked = await bookAs(patient, target.id);
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.code, "ACTIVE_LIMIT");
    assert.match(String(blocked.body.message), /tối đa 1/);

    await PolicyService.update({ maxActiveAppointments: 2 });
    const allowed = await bookAs(patient, target.id);
    assert.equal(allowed.status, 201, JSON.stringify(allowed.body));
  } finally {
    await PolicyService.reset();
  }
});

test("the same person cannot book the same doctor twice in one day", async () => {
  const patient = await asPatient("0955700004");
  const date = fixture.appointmentDate;
  await seed(patient, { date, startTime: "09:00", endTime: "09:30" });

  const sameDoctor = await bookAs(patient, fixture.slotTwo.id); // bác sĩ một, 10:00 cùng ngày
  assert.equal(sameDoctor.status, 409);
  assert.equal(sameDoctor.body.code, "DUPLICATE_SAME_DAY");

  const otherDoctorSlot = await slotOn(fixture.doctorTwo.id, date, "10:00", "10:30");
  const otherDoctor = await bookAs(patient, otherDoctorSlot.id, {}, fixture.doctorTwo.id);
  assert.equal(otherDoctor.status, 201, JSON.stringify(otherDoctor.body));
});

test("the same person cannot hold two overlapping slots with different doctors, adjacent slots are fine", async () => {
  const patient = await asPatient("0955700005");
  const date = fixture.appointmentDate;
  await seed(patient, { date, startTime: "09:00", endTime: "09:30" });

  const overlapping = await slotOn(fixture.doctorTwo.id, date, "09:15", "09:45");
  const blocked = await bookAs(patient, overlapping.id, {}, fixture.doctorTwo.id);
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.code, "TIME_OVERLAP");

  const adjacent = await slotOn(fixture.doctorTwo.id, date, "09:30", "10:00");
  const ok = await bookAs(patient, adjacent.id, {}, fixture.doctorTwo.id);
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
});

test("an unconfirmed hold also blocks a duplicate or overlap for the same person", async () => {
  const first = await http.request("/api/v1/appointments", { method: "POST", body: bookingBody({ phone: "0955700006" }) });
  assert.equal(first.status, 201);
  await prisma.otpCode.updateMany({ data: { createdAt: new Date(Date.now() - 5 * 60_000) } });
  const second = await http.request("/api/v1/appointments", { method: "POST", body: bookingBody({ phone: "0955700006", timeSlotId: fixture.slotTwo.id }) });
  assert.equal(second.status, 409);
  assert.equal(second.body.code, "DUPLICATE_SAME_DAY");
  assert.equal((await prisma.doctorTimeSlot.findUniqueOrThrow({ where: { id: fixture.slotTwo.id } })).status, "AVAILABLE");
});

test("family booking is counted per person, and an account with dependents gets a higher cap", async () => {
  const patient = await asPatient("0955700007");
  const created = await http.request("/api/v1/me/dependents", {
    method: "POST",
    headers: { authorization: patient.authorization },
    body: { fullName: "Con Nhỏ", relationship: "CHILD", dateOfBirth: "2015-05-20", gender: "FEMALE", consentConfirmed: true },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const dependentProfileId = created.body.data.id as string;

  // Chính chủ và con có thể cùng khám một bác sĩ cùng ngày: hai người khác nhau.
  const date = fixture.appointmentDate;
  await seed(patient, { date, startTime: "09:00", endTime: "09:30" });
  const forChild = await bookAs(patient, fixture.slotTwo.id, { dependentProfileId });
  assert.equal(forChild.status, 201, JSON.stringify(forChild.body));

  // Có hồ sơ người thân thì trần là 8: thêm 4 lịch nữa (tổng 6 sắp tới) vẫn đặt được.
  for (const day of distinctDates(4, 30)) await seed(patient, { date: day });
  const target = await slotOn(fixture.doctorOne.id, futureDate(60), "09:00", "09:30");
  const ok = await bookAs(patient, target.id);
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
});

test("cancelling confirmed appointments repeatedly pauses new bookings, abandoned holds do not count", async () => {
  const abandoner = await asPatient("0955700008");
  for (const date of distinctDates(5)) {
    await seed(abandoner, { date, status: "CANCELLED_BY_PATIENT", confirmedAt: null, cancelledAt: new Date() });
  }
  const target = await slotOn(fixture.doctorOne.id, futureDate(40), "09:00", "09:30");
  const okAbandon = await bookAs(abandoner, target.id);
  assert.equal(okAbandon.status, 201, JSON.stringify(okAbandon.body));

  const canceller = await asPatient("0955700009");
  for (const date of distinctDates(5)) {
    await seed(canceller, { date, status: "CANCELLED_BY_PATIENT", cancelledAt: new Date(Date.now() - 10 * 60_000) });
  }
  const second = await slotOn(fixture.doctorOne.id, futureDate(45), "09:00", "09:30");
  const blocked = await bookAs(canceller, second.id);
  assert.equal(blocked.status, 429, JSON.stringify(blocked.body));
  assert.equal(blocked.body.code, "CANCEL_COOLDOWN");
  assert.ok(blocked.body.retryAfterSeconds > 0 && blocked.body.retryAfterSeconds <= 3600, JSON.stringify(blocked.body));

  // Hết một giờ kể từ lần hủy gần nhất thì đặt được lại.
  await prisma.appointment.updateMany({ where: { patientId: canceller.auth.user.id }, data: { cancelledAt: new Date(Date.now() - 2 * 3_600_000) } });
  const later = await bookAs(canceller, second.id);
  assert.equal(later.status, 201, JSON.stringify(later.body));
});

test("parallel bookings cannot slip past the cap", async () => {
  const patient = await asPatient("0955700010");
  const slots = await Promise.all(distinctDates(4, 25).map((date) => slotOn(fixture.doctorOne.id, date, "09:00", "09:30")));
  try {
    await PolicyService.update({ maxActiveAppointments: 1 });
    const results = await Promise.all(slots.map((slot) => bookAs(patient, slot.id)));
    const created = results.filter((result) => result.status === 201);
    assert.equal(created.length, 1, JSON.stringify(results.map((result) => result.status)));
    for (const result of results.filter((item) => item.status !== 201)) assert.equal(result.body.code, "ACTIVE_LIMIT");
    assert.equal(await prisma.appointment.count({ where: { patientId: patient.auth.user.id } }), 1);
  } finally {
    await PolicyService.reset();
  }
});

test("a new account booking several slots at once is confirmed without conflicts", async () => {
  // Hồ sơ người khám của tài khoản mới được tạo khi xác nhận lịch đầu tiên; các lịch đồng thời không được tranh nhau tạo nó.
  const patient = await asPatient("0955700013");
  const slots = await Promise.all(distinctDates(4, 25).map((date) => slotOn(fixture.doctorOne.id, date, "09:00", "09:30")));
  const results = await Promise.all(slots.map((slot) => bookAs(patient, slot.id)));
  assert.deepEqual(results.map((result) => result.status), [201, 201, 201, 201], JSON.stringify(results.map((result) => result.body)));
  assert.equal(await prisma.patientProfile.count({ where: { userId: patient.auth.user.id } }), 1);
});

test("probing staff emails through the booking form blocks the address after a few tries", async () => {
  const probe = (email: string, timeSlotId = fixture.slotOne.id) =>
    http.request("/api/v1/appointments", { method: "POST", body: bookingBody({ phone: "0955700011", email, timeSlotId }) });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await probe(fixture.adminUser.email);
    assert.equal(response.status, 409, `${attempt}: ${JSON.stringify(response.body)}`);
    assert.equal(response.body.code, "EMAIL_UNAVAILABLE");
  }
  assert.equal(await prisma.authAttempt.count({ where: { kind: "BOOKING_EMAIL_PROBE" } }), 5);

  // Từ lần thứ sáu mọi yêu cầu đặt lịch từ IP đó bị chặn, kể cả email hợp lệ, kèm thời gian chờ.
  const blocked = await probe("khach.binh.thuong@example.test");
  assert.equal(blocked.status, 429, JSON.stringify(blocked.body));
  assert.equal(blocked.body.code, "RATE_LIMITED");
  assert.ok(blocked.body.retryAfterSeconds > 0 && blocked.body.retryAfterSeconds <= 3600);
  assert.equal(await prisma.appointment.count(), 0);

  // Cửa sổ trượt: các lượt dò quá một giờ không còn bị tính.
  await prisma.authAttempt.updateMany({ data: { createdAt: new Date(Date.now() - 61 * 60_000) } });
  const afterWindow = await probe("khach.binh.thuong@example.test");
  assert.equal(afterWindow.status, 201, JSON.stringify(afterWindow.body));
});

test("ordinary mistakes do not trip the probe guard", async () => {
  // Email lạ, giữ chỗ lặp, khung giờ đã bị người khác giữ: không phải dấu hiệu dò email.
  const first = await http.request("/api/v1/appointments", { method: "POST", body: bookingBody({ phone: "0955700012" }) });
  assert.equal(first.status, 201);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const taken = await http.request("/api/v1/appointments", { method: "POST", body: bookingBody({ phone: `09557001${20 + attempt}` }) });
    assert.equal(taken.status, 409);
  }
  assert.equal(await prisma.authAttempt.count({ where: { kind: "BOOKING_EMAIL_PROBE" } }), 0);
});
