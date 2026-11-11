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

  const booking = await http.request("/api/v1/appointments", {
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
    `/api/v1/appointments/${pendingSnapshot.id}/verify-otp`,
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

test("health data in a booking requires explicit consent and records which version", async () => {
  const withoutConsent = await http.request("/api/v1/appointments", {
    method: "POST",
    body: { ...bookingBody({ phone: "0955000001" }), allergies: "Penicillin" },
  });
  assert.equal(withoutConsent.status, 400);
  assert.equal(withoutConsent.body.code, "HEALTH_CONSENT_REQUIRED");
  assert.equal(await prisma.appointment.count({ where: { patientPhone: "0955000001" } }), 0);

  const withConsent = await http.request("/api/v1/appointments", {
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
  const plain = await http.request("/api/v1/appointments", {
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
    http.request("/api/v1/dashboard/policy", { method, headers: dashboardHeaders(cookie), body });

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

  const immediate = await http.request("/api/v1/dashboard/notifications", {
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
  const scheduled = await http.request("/api/v1/dashboard/notifications", {
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

  const history = await http.request("/api/v1/dashboard/notifications", {
    headers: dashboardHeaders(adminCookie),
  });
  assert.equal(history.status, 200);
  assert.equal(history.body.data.items.length, 2);
  assert.equal(history.body.data.items[0].recipientCount, 2);

  const cancelled = await http.request(
    `/api/v1/dashboard/notifications/${scheduled.body.data.campaignId}/cancel`,
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

  const segmented = await http.request("/api/v1/dashboard/notifications", {
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

  const invalidExpiry = await http.request("/api/v1/dashboard/notifications", {
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

  const doctorForbidden = await http.request("/api/v1/dashboard/notifications", {
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
    `/api/v1/dashboard/appointments/${originalAppointmentId}/confirm`,
    { method: "PATCH", headers: dashboardHeaders(dashboardCookie) },
  );
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.data.status, "CONFIRMED");

  const rescheduled = await http.request(
    `/api/v1/dashboard/appointments/${originalAppointmentId}/reschedule`,
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
      `/api/v1/dashboard/appointments/${activeAppointmentId}/${action}`,
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
    `/api/v1/dashboard/medical-records/${record.id}`,
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
    `/api/v1/dashboard/medical-records/${record.id}/prescription`,
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
    `/api/v1/dashboard/prescriptions/${prescriptionId}/issue`,
    { method: "PATCH", headers: dashboardHeaders(doctorCookie) },
  );
  assert.equal(issuedPrescription.status, 200);
  assert.equal(issuedPrescription.body.data.status, "ISSUED");

  const completed = await http.request(
    `/api/v1/dashboard/appointments/${activeAppointmentId}/complete`,
    { method: "PATCH", headers: dashboardHeaders(doctorCookie) },
  );
  assert.equal(completed.status, 200);
  assert.equal(completed.body.data.status, "COMPLETED");

  const publishedRecord = await http.request(
    `/api/v1/dashboard/medical-records/${record.id}/publish`,
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
    `/api/v1/dashboard/invoices/appointments/${activeAppointmentId}`,
    {
      method: "POST",
      headers: dashboardHeaders(dashboardCookie),
      body: {},
    },
  );
  assert.equal(createdInvoice.status, 201);
  const invoiceId = createdInvoice.body.data.id as string;

  const paidInvoice = await http.request(
    `/api/v1/dashboard/invoices/${invoiceId}/pay`,
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
      await http.request("/api/v1/dashboard/invoices", {
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
  const invoices = await get("/api/v1/dashboard/invoices/export?status=PAID", adminCookie);
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
  assert.equal((await get("/api/v1/dashboard/invoices/export", staffCookie)).status, 200);
  assert.equal((await get("/api/v1/dashboard/invoices/export", doctorCookie)).status, 403);
  assert.equal((await get("/api/v1/dashboard/invoices/export", pharmacistCookie)).status, 403);

  // Bộ lọc và khoảng ngày sai bị từ chối; lọc theo trạng thái khác thì không có dòng nào.
  assert.equal((await get("/api/v1/dashboard/invoices/export?status=BOGUS", adminCookie)).status, 400);
  assert.equal((await get("/api/v1/dashboard/invoices/export?from=01-01-2026", adminCookie)).status, 400);
  assert.equal(
    (await get("/api/v1/dashboard/invoices/export?from=2020-01-01&to=2026-01-01", adminCookie)).status,
    400,
  );
  const refunded = await get("/api/v1/dashboard/invoices/export?status=REFUNDED", adminCookie);
  assert.equal(refunded.text.trim().split(/\r?\n/).length, 1); // chỉ có dòng tiêu đề

  // Doanh thu theo ngày có dòng tổng; chỉ người có stats.view.
  const revenue = await get("/api/v1/dashboard/statistics/revenue/export", adminCookie);
  assert.equal(revenue.status, 200, revenue.text);
  assert.ok(revenue.text.includes("Tổng,"));
  assert.equal((await get("/api/v1/dashboard/statistics/revenue/export", doctorCookie)).status, 403);

  // Kho thuốc: chỉ dược sĩ; tên thuốc dạng công thức bị chặn.
  await prisma.medicine.create({
    data: { code: "EXP-001", name: '=HYPERLINK("http://evil.example","Bam vao")', unit: "vien", stockQuantity: 3, minStock: 10 },
  });
  const inventory = await get("/api/v1/dashboard/pharmacy/medicines/export", pharmacistCookie);
  assert.equal(inventory.status, 200, inventory.text);
  assert.ok(inventory.text.includes("EXP-001"));
  assert.ok(inventory.text.includes(`'=HYPERLINK`));
  assert.ok(!/(^|,)=HYPERLINK/m.test(inventory.text));
  assert.ok(inventory.text.includes("Có")); // dưới mức tối thiểu (3 < 10)
  assert.equal((await get("/api/v1/dashboard/pharmacy/medicines/export", adminCookie)).status, 403);
  assert.equal((await get("/api/v1/dashboard/pharmacy/movements/export", pharmacistCookie)).status, 200);
  assert.equal(
    (await get("/api/v1/dashboard/pharmacy/movements/export?medicineId=khong-hop-le", pharmacistCookie)).status,
    400,
  );

  // Nhật ký truy cập: chỉ quản trị; mọi lần xuất đều để lại dấu vết (không ghi nội dung).
  assert.equal((await get("/api/v1/dashboard/audit-logs/export", staffCookie)).status, 403);
  const audit = await get("/api/v1/dashboard/audit-logs/export", adminCookie);
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
