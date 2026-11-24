import { assert, http, prisma, test } from "./support/context.js";

// Gửi lại mã đăng nhập người khám: chỉ mã mới nhất dùng được, lần giao hỏng không bắt chờ.

const requestOtp = (email: string) =>
  http.request("/api/v1/auth/patient/request-otp", { method: "POST", body: { email } });

const verify = (challengeId: string, otp: string) =>
  http.request("/api/v1/auth/patient/verify-otp", {
    method: "POST",
    body: { challengeId, otp, deviceId: "otp-resend-device", deviceName: "Integration test device", platform: "android", appVersion: "1.0.0" },
  });

// Lùi giờ tạo mã để vượt qua thời gian chờ gửi lại 60 giây mà không phải đợi thật.
const ageCodes = (email: string, seconds: number) =>
  prisma.otpCode.updateMany({
    where: { email },
    data: { createdAt: new Date(Date.now() - seconds * 1000) },
  });

test("resending closes the previous code so only the newest one signs in", async () => {
  const email = "resend.patient@example.test";
  const first = await requestOtp(email);
  assert.equal(first.status, 200, JSON.stringify(first.body));

  // Gửi lại ngay thì bị chặn, kèm số giây phải chờ để giao diện đếm đúng.
  const tooSoon = await requestOtp(email);
  assert.equal(tooSoon.status, 429);
  assert.equal(tooSoon.body.code, "OTP_COOLDOWN");
  assert.ok(Number(tooSoon.body.retryAfterSeconds) > 0);

  await ageCodes(email, 61);
  const second = await requestOtp(email);
  assert.equal(second.status, 200, JSON.stringify(second.body));
  assert.notEqual(second.body.data.challengeId, first.body.data.challengeId);

  const oldCode = await verify(first.body.data.challengeId, first.body.data.debugOtp);
  assert.equal(oldCode.status, 401, "the code from the earlier email must no longer work");

  const newCode = await verify(second.body.data.challengeId, second.body.data.debugOtp);
  assert.equal(newCode.status, 200, JSON.stringify(newCode.body));
});

test("a code the email provider failed to deliver does not hold the resend cooldown", async () => {
  const email = "undelivered.patient@example.test";
  const first = await requestOtp(email);
  assert.equal(first.status, 200, JSON.stringify(first.body));

  // Mô phỏng nhà cung cấp email từ chối mã vừa gửi.
  await prisma.otpCode.updateMany({ where: { email }, data: { deliveryStatus: "FAILED" } });

  const retry = await requestOtp(email);
  assert.equal(retry.status, 200, JSON.stringify(retry.body));
});
