import { assert, createStoredAppointment, emailOf, http, loginPatient, prisma, test } from "./support/context.js";

// Người khám tự xóa tài khoản: xác thực OTP rồi đóng và ẩn danh; hồ sơ khám giữ lại nhưng không còn gắn danh tính.

const call = (path: string, authorization: string, body?: Record<string, unknown>) =>
  http.request(`/api/v1/me${path}`, { method: body ? "POST" : "GET", headers: { authorization }, body });

test("xác nhận OTP thì đóng và ẩn danh tài khoản, giữ lịch đã khám", async () => {
  const phone = "0911000111";
  const appointment = await createStoredAppointment({ status: "COMPLETED", phone, bookingCode: "DEL-COMPLETED" });
  const auth = await loginPatient(phone);
  const authorization = `Bearer ${auth.accessToken}`;

  const requested = await call("/account-deletion/otp", authorization, {});
  assert.equal(requested.status, 200, JSON.stringify(requested.body));
  const { challengeId, debugOtp } = requested.body.data;
  assert.equal(typeof debugOtp, "string");

  const wrong = await call("/account-deletion/confirm", authorization, { challengeId, otp: debugOtp === "000000" ? "111111" : "000000" });
  assert.notEqual(wrong.status, 200, "sai mã thì không xóa");
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: auth.user.id } })).isActive, true);

  const confirmed = await call("/account-deletion/confirm", authorization, { challengeId, otp: debugOtp });
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));

  const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.user.id } });
  assert.equal(user.isActive, false);
  assert.equal(user.phone, null);
  assert.match(user.email, /^deleted-.+@deleted\.invalid$/);
  assert.notEqual(user.fullName, "Stored Patient");

  // Lịch đã khám còn nguyên (hồ sơ khám phải lưu) nhưng thông tin liên hệ chụp lúc đặt đã ẩn danh.
  const kept = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
  assert.equal(kept.status, "COMPLETED");
  assert.equal(kept.patientPhone, "");
  assert.notEqual(kept.patientEmail, emailOf(phone));

  // Phiên cũ không còn dùng được.
  const afterDeletion = await call("/appointments", authorization);
  assert.equal(afterDeletion.status, 401);

  // Email cũ đăng ký lại được và là một tài khoản mới, không thấy lịch của tài khoản đã xóa.
  const again = await loginPatient(phone);
  assert.notEqual(again.user.id, auth.user.id);
  const list = await call("/appointments", `Bearer ${again.accessToken}`);
  assert.equal(list.status, 200);
  assert.equal(list.body.data.length, 0);

  const audit = await prisma.auditLog.findFirst({ where: { action: "PATIENT_ACCOUNT_DELETED", targetId: auth.user.id } });
  assert.ok(audit, "có ghi nhật ký xóa tài khoản");
});

test("còn lịch chưa khám thì không cho xóa", async () => {
  const phone = "0911000222";
  await createStoredAppointment({ status: "CONFIRMED", phone, bookingCode: "DEL-ACTIVE" });
  const auth = await loginPatient(phone);

  const requested = await call("/account-deletion/otp", `Bearer ${auth.accessToken}`, {});
  assert.equal(requested.status, 409);
  assert.equal(requested.body.code, "ACCOUNT_HAS_ACTIVE_APPOINTMENTS");
});

test("mã đăng nhập không dùng thay mã xác nhận xóa tài khoản", async () => {
  const phone = "0911000333";
  await createStoredAppointment({ status: "COMPLETED", phone, bookingCode: "DEL-LOGIN-CODE" });
  const auth = await loginPatient(phone);
  // Lùi giờ mã vừa dùng để qua thời gian chờ gửi lại, rồi xin một mã đăng nhập mới (chưa dùng).
  await prisma.otpCode.updateMany({ where: { email: emailOf(phone) }, data: { createdAt: new Date(Date.now() - 61_000) } });
  const login = await http.request("/api/v1/auth/patient/request-otp", { method: "POST", body: { email: emailOf(phone) } });
  assert.equal(login.status, 200, JSON.stringify(login.body));

  const misuse = await call("/account-deletion/confirm", `Bearer ${auth.accessToken}`, {
    challengeId: login.body.data.challengeId,
    otp: login.body.data.debugOtp,
  });
  assert.equal(misuse.status, 401);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: auth.user.id } })).isActive, true);
});
