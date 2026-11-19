import LegalService from "../../src/services/legal.service.js";
import { assert, authCookie, bookingBody, dashboardHeaders, emailOf, fixture, http, loginPatient, prisma, test } from "./support/context.js";

// Điều khoản: chưa cấu hình thì không đòi gì; đã cấu hình thì đồng ý đúng phiên bản trước khi gửi OTP (đăng nhập hoặc đặt lịch).

const adminHeaders = async () => dashboardHeaders(await authCookie(fixture.adminUser.id, "ADMIN"));

const saveTerms = async (body: string, title = "Điều khoản sử dụng") => {
  const response = await http.request("/api/v1/dashboard/legal", { method: "PUT", headers: await adminHeaders(), body: { terms: { title, body } } });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body.data.terms as { version: string } | null;
};

const resetLegal = async () => {
  await prisma.appSetting.deleteMany({ where: { scope: "SITE", key: "legal_documents" } });
  LegalService.invalidate();
};

const requestOtp = (email: string, extra: Record<string, unknown> = {}) =>
  http.request("/api/v1/auth/patient/request-otp", { method: "POST", body: { email, ...extra } });

test("nothing is required until the clinic publishes terms", async () => {
  await resetLegal();
  const legal = await http.request("/api/v1/legal");
  assert.equal(legal.status, 200);
  assert.equal(legal.body.data.terms, null);
  assert.equal((await requestOtp("khong.dieu.khoan@example.test")).status, 200);
  const booking = await http.request("/api/v1/appointments", { method: "POST", body: bookingBody({ phone: "0955800001" }) });
  assert.equal(booking.status, 201, JSON.stringify(booking.body));
});

test("published terms must be accepted at the current version before an OTP is sent", async () => {
  try {
    const terms = await saveTerms("Nội dung điều khoản do cơ sở soạn.");
    assert.ok(terms?.version);
    const publicTerms = await http.request("/api/v1/legal");
    assert.equal(publicTerms.body.data.terms.version, terms.version);
    assert.equal(publicTerms.body.data.privacy, null);

    const missing = await requestOtp("dong.y@example.test");
    assert.equal(missing.status, 400);
    assert.equal(missing.body.code, "TERMS_REQUIRED");
    assert.equal(await prisma.user.count({ where: { email: "dong.y@example.test" } }), 0, "no account is created without consent");

    const refused = await requestOtp("dong.y@example.test", { termsAccepted: false, termsVersion: terms.version });
    assert.equal(refused.body.code, "TERMS_REQUIRED");
    const stale = await requestOtp("dong.y@example.test", { termsAccepted: true, termsVersion: "cu" });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.code, "TERMS_OUTDATED");

    const accepted = await requestOtp("dong.y@example.test", { termsAccepted: true, termsVersion: terms.version });
    assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
    const stored = await prisma.user.findUniqueOrThrow({ where: { email: "dong.y@example.test" } });
    assert.equal(stored.termsVersion, terms.version);
    assert.ok(stored.termsAcceptedAt);
  } finally {
    await resetLegal();
  }
});

test("the consent answer is the same for every email, including staff, and staff accounts are never marked", async () => {
  try {
    const terms = await saveTerms("Điều khoản.");
    for (const email of [fixture.adminUser.email, "email.la@example.test"]) {
      const response = await requestOtp(email);
      assert.equal(response.status, 400);
      assert.equal(response.body.code, "TERMS_REQUIRED");
    }
    const staff = await requestOtp(fixture.adminUser.email, { termsAccepted: true, termsVersion: terms!.version });
    assert.equal(staff.status, 200, "staff gets the same decoy answer as anyone");
    const admin = await prisma.user.findUniqueOrThrow({ where: { id: fixture.adminUser.id } });
    assert.equal(admin.termsVersion, null);
  } finally {
    await resetLegal();
  }
});

test("guest booking requires consent and records it, while a logged-in booking does not ask again", async () => {
  try {
    const terms = await saveTerms("Điều khoản đặt lịch.");
    const withoutConsent = await http.request("/api/v1/appointments", { method: "POST", body: bookingBody({ phone: "0955800002" }) });
    assert.equal(withoutConsent.status, 400);
    assert.equal(withoutConsent.body.code, "TERMS_REQUIRED");
    assert.equal((await prisma.doctorTimeSlot.findUniqueOrThrow({ where: { id: fixture.slotOne.id } })).status, "AVAILABLE");

    const withConsent = await http.request("/api/v1/appointments", {
      method: "POST",
      body: { ...bookingBody({ phone: "0955800002" }), termsAccepted: true, termsVersion: terms!.version },
    });
    assert.equal(withConsent.status, 201, JSON.stringify(withConsent.body));
    const patient = await prisma.user.findUniqueOrThrow({ where: { email: emailOf("0955800002") } });
    assert.equal(patient.termsVersion, terms!.version);

    // Đã đăng nhập (qua OTP, đã đồng ý lúc đó): đặt lịch cho chính mình không đòi lại.
    await prisma.appSetting.deleteMany({ where: { scope: "SITE", key: "legal_documents" } });
    LegalService.invalidate();
    const session = await loginPatient("0955800003");
    const newTerms = await saveTerms("Điều khoản mới.");
    const loggedIn = await http.request("/api/v1/appointments", {
      method: "POST",
      headers: { authorization: `Bearer ${session.accessToken}` },
      body: bookingBody({ phone: "0955800003", timeSlotId: fixture.slotTwo.id }),
    });
    assert.equal(loggedIn.status, 201, JSON.stringify(loggedIn.body));
    assert.ok(newTerms);
  } finally {
    await resetLegal();
  }
});

test("editing the terms creates a new version and clearing the body switches the requirement off", async () => {
  try {
    const first = await saveTerms("Bản một.");
    await new Promise((resolve) => setTimeout(resolve, 15));
    const second = await saveTerms("Bản hai.");
    assert.notEqual(first!.version, second!.version);
    assert.equal((await requestOtp("moi@example.test", { termsAccepted: true, termsVersion: first!.version })).body.code, "TERMS_OUTDATED");

    assert.equal(await saveTerms(""), null);
    assert.equal((await requestOtp("moi@example.test")).status, 200);
  } finally {
    await resetLegal();
  }
});

test("only users with the settings permissions can read or edit the legal documents", async () => {
  const doctor = dashboardHeaders(await authCookie(fixture.doctorOneUser.id, "DOCTOR"));
  const read = await http.request("/api/v1/dashboard/legal", { headers: doctor });
  assert.equal(read.status, 403);
  const write = await http.request("/api/v1/dashboard/legal", { method: "PUT", headers: doctor, body: { terms: { title: "x", body: "y" } } });
  assert.equal(write.status, 403);
  const invalid = await http.request("/api/v1/dashboard/legal", { method: "PUT", headers: await adminHeaders(), body: {} });
  assert.equal(invalid.status, 400);
});
