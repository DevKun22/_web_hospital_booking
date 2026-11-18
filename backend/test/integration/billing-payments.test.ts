import { AppointmentService, AuthOtpService, AuthSessionService, InvoiceService, InvoiceMedicineService, InvoiceRefundService, MedicalRecordService, NotificationService, PolicyService, PrescriptionService, RbacService, ScheduleReconciliationService, activeDatabase, activeDatabaseMarker, activeDatabaseSchema, activeDatabaseUrl, after, assert, authCookie, bcrypt, before, beforeEach, bookingBody, buildVnpayCallbackQuery, buildVnpayQueryResponse, buildVnpayRefundResponse, callVnpayRefund, createApp, createDashboardUser, createIssuedPrescription, createMedicineViaApi, createPayableInvoice, createStoredAppointment, createVnpayPaidInvoice, createVnpayPayment, dashboardCall, dashboardHeaders, dateOnly, emailBookingBody, fixture, futureDate, generateDashboardAccessToken, generatePatientAccessToken, getCookie, http, isFirebaseAdminConfigured, isoDateFromToday, jwt, loginPatient, moveAppointmentStart, prisma, receiveViaApi, resetDatabase, seedFixture, startHttpServer, test, vietnamClock, vnpayIpn, withStubbedVnpayQuery, withStubbedVnpayRefund, appointmentLogs, emailOf } from "./support/context.js";

test("invoice creation is rejected until the appointment is COMPLETED", async () => {
  const appointment = await createStoredAppointment({ status: "CONFIRMED" });
  const cookie = await authCookie(fixture.adminUser.id, "ADMIN");
  const endpoint = `/api/v1/dashboard/invoices/appointments/${appointment.id}`;

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
    appointmentLogs.count({
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
    appointmentLogs.count({
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
      provider: "VNPAY",
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

test("patient payment APIs enforce ownership, idempotency and the capability gate", async () => {
  const { invoice, authorization } = await createPayableInvoice({
    bookingCode: "PHASE0-PAYMENT",
  });

  const missingSession = await http.request(
    `/api/v1/me/invoices/${invoice.id}/payments`,
    { method: "POST", body: { provider: "VNPAY" } },
  );
  assert.equal(missingSession.status, 401);

  const capabilities = await http.request("/api/v1/me/payment-capabilities", {
    headers: { authorization },
  });
  assert.equal(capabilities.status, 200);
  assert.deepEqual(
    capabilities.body.data.providers.map((item: { provider: string }) => item.provider),
    ["VNPAY"],
  );
  assert.equal(capabilities.body.data.providers[0].isMock, undefined);

  // Providers that were removed are rejected by validation, not routed anywhere.
  for (const provider of ["MOCK", "MOMO"]) {
    const rejected = await http.request(`/api/v1/me/invoices/${invoice.id}/payments`, {
      method: "POST",
      headers: { authorization },
      body: { provider },
    });
    assert.equal(rejected.status, 400);
  }

  const createResponses = await Promise.all(
    Array.from({ length: 10 }, () =>
      http.request(`/api/v1/me/invoices/${invoice.id}/payments`, {
        method: "POST",
        headers: { authorization, "idempotency-key": "phase0-payment-create-retry" },
        body: { provider: "VNPAY" },
      }),
    ),
  );
  assert.ok(createResponses.every((response) => response.status === 201));
  const [created] = createResponses;
  assert.equal(created.body.data.provider, "VNPAY");
  assert.match(created.body.data.paymentUrl, /^https:\/\/sandbox\.vnpayment\.vn\//);
  assert.equal(new Set(createResponses.map((response) => response.body.data.id)).size, 1);
  assert.equal(
    await prisma.paymentTransaction.count({
      where: { invoiceId: invoice.id, status: "PENDING" },
    }),
    1,
  );

  const idempotentRetry = await http.request(`/api/v1/me/invoices/${invoice.id}/payments`, {
    method: "POST",
    headers: { authorization, "idempotency-key": "phase0-payment-create-retry" },
    body: { provider: "VNPAY" },
  });
  assert.equal(idempotentRetry.status, 201);
  assert.equal(idempotentRetry.body.data.id, created.body.data.id);

  await prisma.user.create({
    data: {
      fullName: "Payment Patient B",
      phone: "0944444444",
      email: emailOf("0944444444"),
      role: "PATIENT",
      isEmailVerified: true,
    },
  });
  const patientBAuthorization = `Bearer ${(await loginPatient("0944444444")).accessToken}`;
  const crossPatientRead = await http.request(`/api/v1/me/payments/${created.body.data.id}`, {
    headers: { authorization: patientBAuthorization },
  });
  assert.equal(crossPatientRead.status, 404);

  // The simulated-settlement endpoints and the generic webhook no longer exist.
  const removedMock = await http.request(
    `/api/v1/me/payments/mock/${created.body.data.transactionCode}/success`,
    { method: "POST", headers: { authorization } },
  );
  assert.equal(removedMock.status, 404);
  const removedWebhook = await http.request("/api/v1/payments/momo/webhook", {
    method: "POST",
    body: {},
  });
  assert.equal(removedWebhook.status, 404);

  const dashboardInvoice = await http.request(`/api/v1/dashboard/invoices/${invoice.id}`, {
    headers: dashboardHeaders(await authCookie(fixture.adminUser.id, "ADMIN")),
  });
  assert.equal(dashboardInvoice.status, 200);
  assert.equal(dashboardInvoice.body.data.paymentTransactions.length, 1);
  assert.equal(dashboardInvoice.body.data.paymentTransactions[0].rawResponse, undefined);

  const originalFlag = process.env.PAYMENT_VNPAY_ENABLED;
  process.env.PAYMENT_VNPAY_ENABLED = "false";
  try {
    const disabledCapabilities = await http.request("/api/v1/me/payment-capabilities", {
      headers: { authorization },
    });
    assert.deepEqual(disabledCapabilities.body.data.providers, []);

    const disabledCreate = await http.request(`/api/v1/me/invoices/${invoice.id}/payments`, {
      method: "POST",
      headers: { authorization },
      body: { provider: "VNPAY" },
    });
    assert.equal(disabledCreate.status, 404);
    assert.equal(disabledCreate.body.code, "PAYMENT_PROVIDER_UNAVAILABLE");
  } finally {
    process.env.PAYMENT_VNPAY_ENABLED = originalFlag;
  }
});

test("VNPay IPN rejects forged callbacks and settles a payment exactly once", async () => {
  const { appointment, invoice, authorization } = await createPayableInvoice({
    bookingCode: "VNPAY-SETTLE",
  });
  const payment = await createVnpayPayment(invoice.id, authorization, "vnpay-settle");
  const expectUnpaid = async () =>
    assert.equal(
      (await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status,
      "UNPAID",
    );

  // Tampered amount after signing, wrong secret, wrong merchant, unknown reference.
  const signed = buildVnpayCallbackQuery({ transactionCode: payment.transactionCode, amount: 300000 });
  assert.equal((await vnpayIpn(signed.replace("vnp_Amount=30000000", "vnp_Amount=100"))).body.RspCode, "97");
  assert.equal(
    (await vnpayIpn(buildVnpayCallbackQuery({ transactionCode: payment.transactionCode, amount: 300000, secret: "WRONGSECRETWRONGSECRETWRONGSEC12" }))).body.RspCode,
    "97",
  );
  assert.equal((await vnpayIpn("vnp_ResponseCode=00")).body.RspCode, "97");
  assert.equal(
    (await vnpayIpn(buildVnpayCallbackQuery({ transactionCode: payment.transactionCode, amount: 300000, tmnCode: "OTHERTMN" }))).body.RspCode,
    "99",
  );
  assert.equal(
    (await vnpayIpn(buildVnpayCallbackQuery({ transactionCode: "NO-SUCH-TXN", amount: 300000 }))).body.RspCode,
    "01",
  );
  // Correctly signed but for a different amount than the invoice.
  assert.equal(
    (await vnpayIpn(buildVnpayCallbackQuery({ transactionCode: payment.transactionCode, amount: 100000 }))).body.RspCode,
    "04",
  );
  await expectUnpaid();
  assert.equal(
    (await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: payment.id } })).status,
    "PENDING",
  );

  // Two identical valid IPNs in parallel, then a replay: one settlement only.
  const results = await Promise.all([vnpayIpn(signed), vnpayIpn(signed)]);
  assert.ok(results.every((response) => response.status === 200 && response.body.RspCode === "00"));
  assert.equal((await vnpayIpn(signed)).body.RspCode, "00");

  const paid = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
  assert.equal(paid.status, "PAID");
  assert.equal(paid.paymentMethod, "VNPAY");
  assert.equal(paid.paymentReference, "14000001");
  assert.equal(
    (await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: payment.id } })).status,
    "SUCCESS",
  );
  assert.equal(
    await appointmentLogs.count({
      where: { appointmentId: appointment.id, action: "PAYMENT_RECORDED" },
    }),
    1,
  );
  assert.equal(
    await prisma.notification.count({
      where: { userId: appointment.patientId, type: "PAYMENT_SUCCEEDED" },
    }),
    1,
  );
});

test("VNPay return URL records the result and redirects to the web result page", async () => {
  const { invoice, authorization } = await createPayableInvoice({
    bookingCode: "VNPAY-RETURN",
  });
  const payment = await createVnpayPayment(invoice.id, authorization, "vnpay-return");

  const success = await http.request(
    `/api/v1/payments/vnpay/return?${buildVnpayCallbackQuery({ transactionCode: payment.transactionCode, amount: 300000 })}`,
    { redirect: "manual" },
  );
  assert.equal(success.status, 302);
  const location = new URL(success.headers.get("location") || "");
  assert.equal(location.origin + location.pathname, "https://web.example.test/thanh-toan/ket-qua");
  assert.equal(location.searchParams.get("status"), "success");
  assert.equal(location.searchParams.get("orderId"), payment.transactionCode);
  assert.equal(
    (await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status,
    "PAID",
  );

  const forged = await http.request(
    `/api/v1/payments/vnpay/return?${buildVnpayCallbackQuery({ transactionCode: payment.transactionCode, amount: 300000, secret: "WRONGSECRETWRONGSECRETWRONGSEC12" })}`,
    { redirect: "manual" },
  );
  assert.equal(forged.status, 302);
  assert.equal(new URL(forged.headers.get("location") || "").searchParams.get("status"), "error");
});

test("a cancelled VNPay payment frees the invoice and a late success is not applied", async () => {
  const { invoice, authorization } = await createPayableInvoice({
    bookingCode: "VNPAY-FAILED",
  });
  const first = await createVnpayPayment(invoice.id, authorization, "vnpay-failed-1");

  // Customer cancelled on the VNPay page (code 24): a valid callback, not a payment.
  const cancelled = await vnpayIpn(
    buildVnpayCallbackQuery({ transactionCode: first.transactionCode, amount: 300000, responseCode: "24" }),
  );
  assert.equal(cancelled.body.RspCode, "00");
  const cancelledTransaction = await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: first.id } });
  assert.equal(cancelledTransaction.status, "CANCELLED");
  assert.equal(cancelledTransaction.activeKey, null);
  assert.equal(
    (await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status,
    "UNPAID",
  );

  // A success that arrives for an already-cancelled transaction conflicts (code 02).
  const late = await vnpayIpn(
    buildVnpayCallbackQuery({ transactionCode: first.transactionCode, amount: 300000 }),
  );
  assert.equal(late.body.RspCode, "02");
  assert.equal(
    (await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status,
    "UNPAID",
  );

  // The patient can start a fresh payment afterwards.
  const second = await createVnpayPayment(invoice.id, authorization, "vnpay-failed-2");
  assert.notEqual(second.id, first.id);
});

test("a declined VNPay payment stays FAILED and frees the invoice", async () => {
  const { invoice, authorization } = await createPayableInvoice({
    bookingCode: "VNPAY-DECLINED",
  });
  const first = await createVnpayPayment(invoice.id, authorization, "vnpay-declined-1");

  // Any failure code other than the customer cancel (24) is a decline, not a cancel.
  const declined = await vnpayIpn(
    buildVnpayCallbackQuery({ transactionCode: first.transactionCode, amount: 300000, responseCode: "51" }),
  );
  assert.equal(declined.body.RspCode, "00");
  const failed = await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: first.id } });
  assert.equal(failed.status, "FAILED");
  assert.equal(failed.activeKey, null);
  assert.equal(
    (await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status,
    "UNPAID",
  );
});

test("an expired VNPay transaction becomes EXPIRED but a genuine late success still pays", async () => {
  const { invoice, authorization } = await createPayableInvoice({
    bookingCode: "VNPAY-EXPIRY",
  });
  const payment = await createVnpayPayment(invoice.id, authorization, "vnpay-expiry");
  await prisma.paymentTransaction.update({
    where: { id: payment.id },
    data: { expiredAt: new Date(Date.now() - 1000) },
  });

  const expired = await http.request(`/api/v1/me/payments/${payment.id}`, {
    headers: { authorization },
  });
  assert.equal(expired.status, 200);
  assert.equal(expired.body.data.status, "EXPIRED");
  assert.equal(
    (await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: payment.id } })).activeKey,
    null,
  );

  // The gateway can still confirm money that was actually taken after our timeout.
  const late = await vnpayIpn(
    buildVnpayCallbackQuery({ transactionCode: payment.transactionCode, amount: 300000 }),
  );
  assert.equal(late.body.RspCode, "00");
  assert.equal(
    (await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status,
    "PAID",
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
          fulfillmentStatus: "OUTSIDE",
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
  await InvoiceRefundService.refund(invoice.id, { refundReason: "Integration test" });

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

test("v1 capabilities reflect the payment providers enabled by configuration", async () => {
  const response = await http.request("/api/v1/capabilities");
  assert.equal(response.status, 200);
  assert.equal(response.body.data.payment.enabled, true);
  assert.equal(response.body.data.payment.reason, null);
  assert.deepEqual(response.body.data.payment.supportedProviders, ["VNPAY"]);
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

test("querydr reconciliation settles a payment whose Return URL and IPN were both lost", async () => {
  const { default: PaymentService } = await import("../../src/services/payment.service.js");
  const { invoice, authorization, appointment } = await createPayableInvoice({
    bookingCode: "VNPAY-QUERYDR-PAID",
  });
  const payment = await createVnpayPayment(invoice.id, authorization, "vnpay-querydr-paid");
  // Giao dịch đã treo đủ lâu để quét định kỳ chú ý tới.
  await prisma.paymentTransaction.update({
    where: { id: payment.id },
    data: { createdAt: new Date(Date.now() - 10 * 60 * 1000) },
  });

  await withStubbedVnpayQuery(
    (txnRef) => buildVnpayQueryResponse({ transactionCode: txnRef, amount: 300000 }),
    async () => {
      const summary = await PaymentService.reconcilePendingVnpay();
      assert.equal(summary.scanned, 1);
      assert.equal(summary.paid, 1);
      assert.equal(summary.errors, 0);
      // Quét lại: giao dịch đã SUCCESS nên không còn ứng viên và không ghi nhận lần hai.
      assert.equal((await PaymentService.reconcilePendingVnpay()).scanned, 0);
    },
  );

  const paid = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
  assert.equal(paid.status, "PAID");
  assert.equal(paid.paymentMethod, "VNPAY");
  assert.equal(paid.paymentReference, "15000001");
  assert.equal(
    (await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: payment.id } })).status,
    "SUCCESS",
  );
  assert.equal(
    await appointmentLogs.count({
      where: { appointmentId: appointment.id, action: "PAYMENT_RECORDED" },
    }),
    1,
  );
  assert.equal(
    await prisma.notification.count({
      where: { userId: appointment.patientId, type: "PAYMENT_SUCCEEDED" },
    }),
    1,
  );
});

test("querydr reconciliation keeps young pending payments, expires abandoned ones and records failures", async () => {
  const { default: PaymentService } = await import("../../src/services/payment.service.js");
  const { invoice, authorization } = await createPayableInvoice({
    bookingCode: "VNPAY-QUERYDR-PENDING",
  });
  const payment = await createVnpayPayment(invoice.id, authorization, "vnpay-querydr-pending");

  // Khách chưa hoàn tất (mã giao dịch 01): còn hạn thì giữ PENDING.
  await withStubbedVnpayQuery(
    (txnRef) => buildVnpayQueryResponse({ transactionCode: txnRef, amount: 300000, transactionStatus: "01" }),
    async () => {
      assert.equal((await PaymentService.reconcileVnpayTransaction(payment.id)).outcome, "PENDING");
    },
  );
  assert.equal(
    (await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: payment.id } })).status,
    "PENDING",
  );

  // Quá hạn thanh toán mà VNPAY không có giao dịch (mã 91): chuyển EXPIRED, hóa đơn vẫn UNPAID.
  await withStubbedVnpayQuery(
    (txnRef) =>
      buildVnpayQueryResponse({ transactionCode: txnRef, amount: 300000, responseCode: "91" }),
    async () => {
      const later = new Date(Date.now() + 60 * 60 * 1000);
      assert.equal(
        (await PaymentService.reconcileVnpayTransaction(payment.id, later)).outcome,
        "EXPIRED",
      );
    },
  );
  assert.equal(
    (await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: payment.id } })).status,
    "EXPIRED",
  );
  assert.equal(
    (await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status,
    "UNPAID",
  );

  // Giao dịch mới trên cùng hóa đơn bị VNPAY báo lỗi (mã 02): ghi nhận FAILED, hóa đơn còn UNPAID.
  const second = await createVnpayPayment(invoice.id, authorization, "vnpay-querydr-failed");
  await withStubbedVnpayQuery(
    (txnRef) => buildVnpayQueryResponse({ transactionCode: txnRef, amount: 300000, transactionStatus: "02" }),
    async () => {
      assert.equal((await PaymentService.reconcileVnpayTransaction(second.id)).outcome, "FAILED");
    },
  );
  assert.equal(
    (await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: second.id } })).status,
    "FAILED",
  );
  assert.equal(
    (await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status,
    "UNPAID",
  );
});

test("querydr reconciliation refuses a mismatched amount, a forged response and a VNPAY outage", async () => {
  const { default: PaymentService } = await import("../../src/services/payment.service.js");
  const { invoice, authorization } = await createPayableInvoice({
    bookingCode: "VNPAY-QUERYDR-GUARD",
  });
  const payment = await createVnpayPayment(invoice.id, authorization, "vnpay-querydr-guard");

  await withStubbedVnpayQuery(
    (txnRef) => buildVnpayQueryResponse({ transactionCode: txnRef, amount: 100000 }),
    async () => {
      await assert.rejects(
        PaymentService.reconcileVnpayTransaction(payment.id),
        /Số tiền VNPAY không khớp hóa đơn/,
      );
    },
  );
  await withStubbedVnpayQuery(
    (txnRef) =>
      buildVnpayQueryResponse({
        transactionCode: txnRef,
        amount: 300000,
        secret: "WRONGSECRETWRONGSECRETWRONGSEC12",
      }),
    async () => {
      await assert.rejects(
        PaymentService.reconcileVnpayTransaction(payment.id),
        /Chữ ký phản hồi truy vấn VNPAY không hợp lệ/,
      );
    },
  );

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error("network down");
  }) as unknown as typeof fetch;
  try {
    await assert.rejects(
      PaymentService.reconcileVnpayTransaction(payment.id),
      /Không kết nối được VNPAY/,
    );
    // Lượt xem của người dùng không bị hỏng khi VNPAY gián đoạn.
    await prisma.paymentTransaction.update({
      where: { id: payment.id },
      data: { createdAt: new Date(Date.now() - 10 * 60 * 1000) },
    });
    const viewed = await PaymentService.getByIdWithReconciliation(
      payment.id,
      (await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).patientId,
    );
    assert.equal(viewed.status, "PENDING");
  } finally {
    globalThis.fetch = originalFetch;
  }

  const untouched = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
  assert.equal(untouched.status, "UNPAID");
  assert.equal(
    (await prisma.paymentTransaction.findUniqueOrThrow({ where: { id: payment.id } })).status,
    "PENDING",
  );
});

test("VNPay refund API refunds a VNPAY-paid invoice once and records it", async () => {
  const { invoice, payment, appointment } = await createVnpayPaidInvoice("VNPAY-REFUND-OK");
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");

  let sent: Record<string, unknown> | undefined;
  await withStubbedVnpayRefund(
    (body) => {
      sent = body;
      return buildVnpayRefundResponse({ transactionCode: String(body.vnp_TxnRef), amount: 300000 });
    },
    async () => {
      const refunded = await callVnpayRefund(invoice.id, adminCookie);
      assert.equal(refunded.status, 200, JSON.stringify(refunded.body));
      assert.equal(refunded.body.data.status, "REFUNDED");
      // Gửi đúng giao dịch gốc: mã VNPAY của lần trả tiền và đúng số tiền.
      assert.equal(sent?.vnp_TxnRef, payment.transactionCode);
      assert.equal(sent?.vnp_TransactionNo, "14000001");
      assert.equal(sent?.vnp_Amount, 30000000);
      assert.equal(sent?.vnp_TransactionType, "02");

      // Gọi lần hai không gửi thêm yêu cầu hoàn nào.
      sent = undefined;
      assert.equal((await callVnpayRefund(invoice.id, adminCookie)).status, 409);
      assert.equal(sent, undefined);
    },
  );

  const stored = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
  assert.equal(stored.status, "REFUNDED");
  assert.equal(stored.refundReference, "16000001");
  assert.ok(stored.refundRequestId);
  assert.equal(
    await appointmentLogs.count({
      where: { appointmentId: appointment.id, action: "PAYMENT_REFUNDED" },
    }),
    1,
  );
  assert.equal(
    await prisma.notification.count({
      where: { userId: appointment.patientId, type: "PAYMENT_REFUNDED" },
    }),
    1,
  );
});

test("VNPay refund API frees the invoice after a definite rejection", async () => {
  const { invoice } = await createVnpayPaidInvoice("VNPAY-REFUND-REJECT");
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");

  await withStubbedVnpayRefund(
    (body) =>
      buildVnpayRefundResponse({
        transactionCode: String(body.vnp_TxnRef),
        amount: 300000,
        responseCode: "95",
      }),
    async () => {
      const rejected = await callVnpayRefund(invoice.id, adminCookie);
      assert.equal(rejected.status, 422);
      assert.equal(rejected.body.code, "VNPAY_REFUND_REJECTED");
    },
  );
  const afterReject = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
  assert.equal(afterReject.status, "PAID");
  assert.equal(afterReject.refundRequestId, null);

  // Bị từ chối rõ ràng nên thử lại được.
  await withStubbedVnpayRefund(
    (body) => buildVnpayRefundResponse({ transactionCode: String(body.vnp_TxnRef), amount: 300000 }),
    async () => assert.equal((await callVnpayRefund(invoice.id, adminCookie)).status, 200),
  );
  assert.equal(
    (await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status,
    "REFUNDED",
  );
});

test("VNPay refund API never retries an unverifiable result and allows manual confirmation", async () => {
  const { invoice } = await createVnpayPaidInvoice("VNPAY-REFUND-UNKNOWN");
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");

  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (!String(url).includes("merchant_webapi")) return originalFetch(url, init);
    calls += 1;
    throw new Error("network down");
  }) as unknown as typeof fetch;
  try {
    const first = await callVnpayRefund(invoice.id, adminCookie);
    assert.equal(first.status, 502);
    assert.equal(first.body.code, "VNPAY_REFUND_UNVERIFIED");
    assert.equal(calls, 1);

    // Tiền có thể đã được hoàn: không gửi thêm yêu cầu nào nữa.
    const second = await callVnpayRefund(invoice.id, adminCookie);
    assert.equal(second.status, 409);
    assert.equal(second.body.code, "REFUND_PENDING_VERIFICATION");
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }

  const pending = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
  assert.equal(pending.status, "PAID");
  assert.ok(pending.refundRequestId);

  // Sau khi kiểm tra trên cổng VNPAY, quản trị ghi nhận thủ công như trước.
  const manual = await http.request(`/api/v1/dashboard/invoices/${invoice.id}/refund`, {
    method: "PATCH",
    headers: dashboardHeaders(adminCookie),
    body: { refundReason: "Da xac nhan tren cong VNPAY", refundReference: "VNP-MANUAL-1" },
  });
  assert.equal(manual.status, 200);
  assert.equal(manual.body.data.status, "REFUNDED");
});

test("VNPay refund API refuses non-VNPAY invoices and users without invoice.refund", async () => {
  const cash = await createPayableInvoice({ bookingCode: "VNPAY-REFUND-CASH" });
  await InvoiceService.pay(cash.invoice.id, { paymentMethod: "CASH" }, fixture.adminUser.id);
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");
  const staff = await createDashboardUser("STAFF", "0900000099");
  const staffCookie = await authCookie(staff.id, "STAFF");

  assert.equal((await callVnpayRefund(cash.invoice.id, adminCookie)).status, 409);
  assert.equal((await callVnpayRefund(cash.invoice.id, staffCookie)).status, 403);
  assert.equal((await callVnpayRefund(cash.invoice.id, adminCookie, "ab")).status, 400);
});

test("only a doctor finishes an exam by default, and invoice adjustments are audited", async () => {
  const staff = await createDashboardUser("STAFF", "0900000103");
  const staffCookie = await authCookie(staff.id, "STAFF");
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");

  // Quyền được kiểm trước khi chạm vào lịch hẹn nên không cần dữ liệu thật.
  assert.equal(
    (await dashboardCall("PATCH", "/api/v1/dashboard/appointments/any-id/complete", staffCookie, {})).status,
    403,
  );
  assert.notEqual(
    (await dashboardCall("PATCH", "/api/v1/dashboard/appointments/any-id/start", staffCookie, {})).status,
    403,
  );

  const { invoice, appointment: adjustAppointment } = await createPayableInvoice({
    bookingCode: "AUDIT-ADJUST",
  });
  await prisma.appointmentPatientInfo.update({
    where: { appointmentId: adjustAppointment.id },
    data: { hasBHYT: true },
  });
  const adjusted = await dashboardCall(
    "PATCH",
    `/api/v1/dashboard/invoices/${invoice.id}`,
    staffCookie,
    { bhytDiscount: 50000 },
  );
  assert.equal(adjusted.status, 200, JSON.stringify(adjusted.body));
  const adjustAudit = await prisma.auditLog.findFirstOrThrow({
    where: { action: "INVOICE_ADJUSTED", targetId: invoice.id },
  });
  assert.equal(adjustAudit.actorId, staff.id);
  assert.deepEqual((adjustAudit.meta as { before: unknown }).before, {
    discount: 0,
    finalAmount: 300000,
  });
  assert.deepEqual((adjustAudit.meta as { after: unknown }).after, {
    discount: 50000,
    finalAmount: 250000,
  });

  // Hoàn tiền thủ công cũng để lại dấu vết (dùng lại hóa đơn trên sau khi thu tiền mặt).
  const paid = { invoice };
  await InvoiceService.pay(paid.invoice.id, { paymentMethod: "CASH" }, fixture.adminUser.id);
  const refunded = await dashboardCall(
    "PATCH",
    `/api/v1/dashboard/invoices/${paid.invoice.id}/refund`,
    adminCookie,
    { refundReason: "Benh nhan huy dich vu" },
  );
  assert.equal(refunded.status, 200);
  const refundAudit = await prisma.auditLog.findFirstOrThrow({
    where: { action: "INVOICE_REFUNDED", targetId: paid.invoice.id },
  });
  assert.equal((refundAudit.meta as { via: string }).via, "MANUAL");
});

test("invoices bill prescribed stock medicines, and unpaid invoices get exactly one reminder", async () => {
  const { default: InvoiceService } = await import("../../src/services/invoice.service.js");
  const staff = await createDashboardUser("STAFF", "0900000071");
  const staffCookie = await authCookie(staff.id, "STAFF");

  const pricedMedicine = await prisma.medicine.create({ data: { code: "BILL-PRICED", name: "Thuốc có giá", unit: "viên", unitPrice: 2500 } });
  const freeMedicine = await prisma.medicine.create({ data: { code: "BILL-FREE", name: "Thuốc không giá", unit: "viên" } });

  const { appointment, prescription } = await createIssuedPrescription({
    code: "RX-BILL",
    phone: "0944000071",
    timeSlotId: fixture.slotOne.id,
    items: [
      { medicineName: "Thuốc có giá", quantity: 4, medicineId: pricedMedicine.id },
      { medicineName: "Thuốc không giá", quantity: 3, medicineId: freeMedicine.id },
      { medicineName: "Thuốc mua ngoài", quantity: 2 },
    ],
  });
  // Tiền thuốc tính theo số lượng thực cấp: đã cấp 4 viên thuốc có giá (kê 4), thuốc không giá cấp 3.
  await prisma.prescriptionItem.updateMany({ where: { prescriptionId: prescription.id, medicineId: pricedMedicine.id }, data: { dispensedQuantity: 4 } });
  await prisma.prescriptionItem.updateMany({ where: { prescriptionId: prescription.id, medicineId: freeMedicine.id }, data: { dispensedQuantity: 3 } });

  const created = await http.request(`/api/v1/dashboard/invoices/appointments/${appointment.id}`, {
    method: "POST",
    headers: dashboardHeaders(staffCookie),
    body: {},
  });
  assert.equal(created.status, 201);
  const items = created.body.data.items as { type: string; description: string; quantity: number; unitPrice: number; amount: number }[];
  const medicineLines = items.filter((item) => item.type === "MEDICINE");
  assert.equal(medicineLines.length, 1);
  assert.equal(medicineLines[0].quantity, 4);
  assert.equal(medicineLines[0].unitPrice, 2500);
  assert.equal(medicineLines[0].amount, 10000);
  const consultation = items.filter((item) => item.type !== "MEDICINE").reduce((sum, item) => sum + item.amount, 0);
  assert.equal(created.body.data.totalAmount, consultation + 10000);

  // Nhắc thanh toán: chưa đủ 24 giờ thì chưa nhắc, sau 24 giờ nhắc đúng một lần.
  const early = await InvoiceService.sendPaymentReminders();
  assert.equal(early.reminded, 0);
  const later = new Date(Date.now() + 25 * 60 * 60 * 1000);
  const first = await InvoiceService.sendPaymentReminders({ now: later });
  assert.equal(first.reminded, 1);
  const second = await InvoiceService.sendPaymentReminders({ now: later });
  assert.equal(second.reminded, 0);
  const reminders = await prisma.notification.count({
    where: { userId: appointment.patientId, title: "Hóa đơn đang chờ thanh toán" },
  });
  assert.equal(reminders, 1);

  // Hóa đơn đã thanh toán thì không nhắc nữa.
  await prisma.invoice.update({ where: { id: created.body.data.id }, data: { status: "PAID", paidAt: new Date() } });
  const afterPaid = await InvoiceService.sendPaymentReminders({ now: new Date(Date.now() + 49 * 60 * 60 * 1000) });
  assert.equal(afterPaid.reminded, 0);
});

test("completing a visit creates the invoice by itself and tells reception to collect it", async () => {
  const staff = await createDashboardUser("STAFF", "0900000072");
  const staffCookie = await authCookie(staff.id, "STAFF");
  const doctorCookie = await authCookie(fixture.doctorOneUser.id, "DOCTOR");
  const appointment = await createStoredAppointment({ status: "CHECKED_IN", bookingCode: "BK-COMPLETE-NOTE", phone: "0944000072", timeSlotId: fixture.slotTwo.id });
  const started = await http.request(`/api/v1/dashboard/appointments/${appointment.id}/start`, { method: "PATCH", headers: dashboardHeaders(doctorCookie) });
  assert.equal(started.status, 200);
  const finished = await http.request(`/api/v1/dashboard/appointments/${appointment.id}/complete`, { method: "PATCH", headers: dashboardHeaders(doctorCookie) });
  assert.equal(finished.status, 200);
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { appointmentId: appointment.id } });
  assert.equal(invoice.status, "UNPAID");
  const inbox = await http.request("/api/v1/dashboard/inbox", { headers: dashboardHeaders(staffCookie) });
  assert.ok(inbox.body.data.items.some((item: { title: string }) => item.title.includes("hóa đơn chờ thu")));
  // Lập tay cho lịch đã có hóa đơn tự tạo thì báo đã tồn tại, không tạo thêm.
  const again = await http.request(`/api/v1/dashboard/invoices/appointments/${appointment.id}`, { method: "POST", headers: dashboardHeaders(staffCookie), body: {} });
  assert.equal(again.status, 409);
  assert.equal(again.body.code, "INVOICE_ALREADY_EXISTS");
});

test("a completed visit publishes its record by itself once the invoice is paid and the record has a conclusion", async () => {
  const staff = await createDashboardUser("STAFF", "0900000073");
  const staffCookie = await authCookie(staff.id, "STAFF");
  const doctorCookie = await authCookie(fixture.doctorOneUser.id, "DOCTOR");
  const appointment = await createStoredAppointment({ status: "CHECKED_IN", bookingCode: "BK-AUTOPUB", phone: "0944000073", timeSlotId: fixture.slotOne.id });
  await http.request(`/api/v1/dashboard/appointments/${appointment.id}/start`, { method: "PATCH", headers: dashboardHeaders(doctorCookie) });
  const record = await prisma.medicalRecord.findUniqueOrThrow({ where: { appointmentId: appointment.id } });
  const publishedAt = async () => (await prisma.medicalRecord.findUniqueOrThrow({ where: { id: record.id } })).status;
  await http.request(`/api/v1/dashboard/appointments/${appointment.id}/complete`, { method: "PATCH", headers: dashboardHeaders(doctorCookie) });
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { appointmentId: appointment.id } });
  const pay = () => http.request(`/api/v1/dashboard/invoices/${invoice.id}/pay`, { method: "PATCH", headers: dashboardHeaders(staffCookie), body: { paymentMethod: "CASH" } });

  // Đã thu nhưng hồ sơ chưa có kết luận: chưa công bố.
  assert.equal((await pay()).status, 200);
  assert.equal(await publishedAt(), "DRAFT");

  // Bác sĩ ghi kết luận sau khi đã thu: hồ sơ tự mở cho người khám và người khám được báo đúng một lần.
  const updated = await http.request(`/api/v1/dashboard/medical-records/${record.id}`, {
    method: "PATCH",
    headers: dashboardHeaders(doctorCookie),
    body: { diagnosis: "Viêm họng cấp" },
  });
  assert.equal(updated.status, 200);
  assert.equal(await publishedAt(), "PUBLISHED");
  assert.equal(await prisma.notification.count({ where: { userId: appointment.patientId, type: "MEDICAL_RESULT_PUBLISHED" } }), 1);
});

test("a record with a conclusion is published right when the invoice is paid", async () => {
  const staff = await createDashboardUser("STAFF", "0900000074");
  const staffCookie = await authCookie(staff.id, "STAFF");
  const doctorCookie = await authCookie(fixture.doctorOneUser.id, "DOCTOR");
  const appointment = await createStoredAppointment({ status: "CHECKED_IN", bookingCode: "BK-AUTOPUB2", phone: "0944000074", timeSlotId: fixture.slotTwo.id });
  await http.request(`/api/v1/dashboard/appointments/${appointment.id}/start`, { method: "PATCH", headers: dashboardHeaders(doctorCookie) });
  const record = await prisma.medicalRecord.findUniqueOrThrow({ where: { appointmentId: appointment.id } });
  await http.request(`/api/v1/dashboard/medical-records/${record.id}`, { method: "PATCH", headers: dashboardHeaders(doctorCookie), body: { treatment: "Nghỉ ngơi" } });
  await http.request(`/api/v1/dashboard/appointments/${appointment.id}/complete`, { method: "PATCH", headers: dashboardHeaders(doctorCookie) });
  // Chưa thu tiền: hồ sơ còn là bản nháp.
  assert.equal((await prisma.medicalRecord.findUniqueOrThrow({ where: { id: record.id } })).status, "DRAFT");
  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { appointmentId: appointment.id } });
  const paid = await http.request(`/api/v1/dashboard/invoices/${invoice.id}/pay`, { method: "PATCH", headers: dashboardHeaders(staffCookie), body: { paymentMethod: "CASH" } });
  assert.equal(paid.status, 200);
  assert.equal((await prisma.medicalRecord.findUniqueOrThrow({ where: { id: record.id } })).status, "PUBLISHED");
});

test("medicine charges are on the invoice from issue time, and dispensing needs payment with no way around it", async () => {
  const pharmacist = await createDashboardUser("PHARMACIST", "0900000081");
  const staff = await createDashboardUser("STAFF", "0900000082");
  const pharmacistCookie = await authCookie(pharmacist.id, "PHARMACIST");
  const staffCookie = await authCookie(staff.id, "STAFF");
  const medicine = await createMedicineViaApi(pharmacistCookie, { code: "BILL-LATE", name: "Thuốc cấp sau", unitPrice: 4000 });
  await receiveViaApi(pharmacistCookie, medicine.id, 20);

  const { appointment, prescription } = await createIssuedPrescription({
    code: "RX-LATE",
    phone: "0944000081",
    timeSlotId: fixture.slotOne.id,
    items: [{ medicineName: "Thuốc cấp sau", quantity: 5, medicineId: medicine.id }],
  });
  // Lễ tân lập hóa đơn khi đơn đã phát hành: tiền thuốc (5 x 4000) có ngay, không chờ đến lúc cấp.
  const created = await http.request(`/api/v1/dashboard/invoices/appointments/${appointment.id}`, {
    method: "POST",
    headers: dashboardHeaders(staffCookie),
    body: {},
  });
  assert.equal(created.status, 201);
  const createdLines = (created.body.data.items as { type: string; quantity: number; amount: number }[]).filter((item) => item.type === "MEDICINE");
  assert.equal(createdLines.length, 1);
  assert.equal(createdLines[0].quantity, 5);
  assert.equal(createdLines[0].amount, 20000);
  const baseTotal = created.body.data.totalAmount as number;

  const dispense = (body: Record<string, unknown>) =>
    http.request(`/api/v1/dashboard/pharmacy/prescriptions/${prescription.id}/dispense`, {
      method: "POST",
      headers: dashboardHeaders(pharmacistCookie),
      body,
    });

  // Hóa đơn chưa thanh toán: không cấp được, và gửi kèm lý do cũng không mở được đường cấp trước.
  const blocked = await dispense({ confirmed: true });
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.code, "PAYMENT_REQUIRED");
  const withReason = await dispense({ confirmed: true, unpaidReason: "Cấp cứu, quản lý đã duyệt" });
  assert.equal(withReason.status, 409);
  assert.equal(withReason.body.code, "PAYMENT_REQUIRED");
  assert.equal((await prisma.prescription.findUniqueOrThrow({ where: { id: prescription.id } })).dispenseStatus, "NOT_DISPENSED");

  // Thu tiền xong thì cấp được; hóa đơn không đổi (không tính tiền thuốc hai lần).
  await prisma.invoice.update({ where: { id: created.body.data.id }, data: { status: "PAID", paidAt: new Date() } });
  const ok = await dispense({ confirmed: true });
  assert.equal(ok.status, 200);
  const invoice = await http.request(`/api/v1/dashboard/invoices/${created.body.data.id}`, { headers: dashboardHeaders(staffCookie) });
  assert.equal(invoice.status, 200);
  assert.equal(invoice.body.data.totalAmount, baseTotal);
  assert.equal((invoice.body.data.items as { type: string }[]).filter((item) => item.type === "MEDICINE").length, 1);
});

test("a paid invoice that already carries the medicine lets the pharmacist dispense without a reason", async () => {
  const pharmacist = await createDashboardUser("PHARMACIST", "0900000083");
  const staff = await createDashboardUser("STAFF", "0900000084");
  const pharmacistCookie = await authCookie(pharmacist.id, "PHARMACIST");
  const staffCookie = await authCookie(staff.id, "STAFF");
  const medicine = await createMedicineViaApi(pharmacistCookie, { code: "BILL-PAID", name: "Thuốc sau thanh toán", unitPrice: 1000 });
  await receiveViaApi(pharmacistCookie, medicine.id, 10);
  const { appointment, prescription } = await createIssuedPrescription({
    code: "RX-PAID",
    phone: "0944000083",
    timeSlotId: fixture.slotTwo.id,
    items: [{ medicineName: "Thuốc sau thanh toán", quantity: 2, medicineId: medicine.id }],
  });
  const created = await http.request(`/api/v1/dashboard/invoices/appointments/${appointment.id}`, {
    method: "POST",
    headers: dashboardHeaders(staffCookie),
    body: {},
  });
  assert.equal(created.status, 201);
  await prisma.invoice.update({ where: { id: created.body.data.id }, data: { status: "PAID", paidAt: new Date() } });
  const before = created.body.data.totalAmount as number;

  const dispensed = await http.request(`/api/v1/dashboard/pharmacy/prescriptions/${prescription.id}/dispense`, {
    method: "POST",
    headers: dashboardHeaders(pharmacistCookie),
    body: { confirmed: true },
  });
  assert.equal(dispensed.status, 200);
  const after = await prisma.invoice.findUniqueOrThrow({ where: { id: created.body.data.id }, include: { items: true } });
  assert.equal(after.totalAmount, before);
  assert.equal(after.items.filter((item) => item.type === "MEDICINE").length, 1);
  // Tiền thuốc đã nằm trong hóa đơn từ trước nên không có gì phải báo nhân viên.
  const inbox = await http.request("/api/v1/dashboard/inbox", { headers: dashboardHeaders(staffCookie) });
  assert.equal(inbox.body.data.items.some((item: { title: string }) => item.title === "Tiền thuốc chưa tính vào hóa đơn"), false);
});

test("a prescription issued after the invoice was paid becomes a supplement collected at the counter before dispensing", async () => {
  const pharmacist = await createDashboardUser("PHARMACIST", "0900000085");
  const staff = await createDashboardUser("STAFF", "0900000086");
  const pharmacistCookie = await authCookie(pharmacist.id, "PHARMACIST");
  const staffCookie = await authCookie(staff.id, "STAFF");
  const doctorCookie = await authCookie(fixture.doctorOneUser.id, "DOCTOR");
  const medicineA = await createMedicineViaApi(pharmacistCookie, { code: "BILL-SUP-A", name: "Thuốc bổ sung A", unitPrice: 3000 });
  const medicineB = await createMedicineViaApi(pharmacistCookie, { code: "BILL-SUP-B", name: "Thuốc bổ sung B", unitPrice: 1000 });
  await receiveViaApi(pharmacistCookie, medicineA.id, 10);
  await receiveViaApi(pharmacistCookie, medicineB.id, 10);
  const { appointment, prescription } = await createIssuedPrescription({
    code: "RX-MISSING",
    phone: "0944000085",
    timeSlotId: fixture.slotOne.id,
    items: [
      { medicineName: "Thuốc bổ sung A", quantity: 2, medicineId: medicineA.id },
      { medicineName: "Thuốc bổ sung B", quantity: 4, medicineId: medicineB.id },
    ],
  });
  // Đơn còn nháp khi lập hóa đơn, hóa đơn được thu tiền xong rồi bác sĩ mới phát hành đơn.
  await prisma.prescription.update({ where: { id: prescription.id }, data: { status: "DRAFT", issuedAt: null } });
  const created = await http.request(`/api/v1/dashboard/invoices/appointments/${appointment.id}`, {
    method: "POST",
    headers: dashboardHeaders(staffCookie),
    body: {},
  });
  assert.equal(created.status, 201);
  const invoiceId = created.body.data.id as string;
  const baseTotal = created.body.data.totalAmount as number;
  await prisma.invoice.update({ where: { id: invoiceId }, data: { status: "PAID", paymentMethod: "CASH", paidAt: new Date() } });

  const doctorActor = { userId: fixture.doctorOneUser.id, role: "DOCTOR" as const };
  await PrescriptionService.issue(prescription.id, doctorActor);
  // Hóa đơn chính đã thu không bị sửa; tiền thuốc thành hóa đơn bổ sung chưa thu (2 x 3000 + 4 x 1000).
  const main = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { items: true, supplements: { include: { items: true } } } });
  assert.equal(main.totalAmount, baseTotal);
  assert.equal(main.items.filter((item) => item.type === "MEDICINE").length, 0);
  assert.equal(main.supplements.length, 1);
  assert.equal(main.supplements[0].status, "UNPAID");
  assert.equal(main.supplements[0].amount, 10000);
  assert.equal(main.supplements[0].items.length, 2);
  // Gọi đồng bộ lại không tạo thêm hóa đơn bổ sung hay tính hai lần.
  await InvoiceMedicineService.syncMedicineLines(prescription.id, doctorActor);
  assert.equal(await prisma.invoiceSupplement.count({ where: { invoiceId } }), 1);
  assert.equal((await prisma.invoiceSupplement.findFirstOrThrow({ where: { invoiceId } })).amount, 10000);
  // Nhân viên được báo có hóa đơn bổ sung cần thu.
  const inbox = await http.request("/api/v1/dashboard/inbox", { headers: dashboardHeaders(staffCookie) });
  assert.ok(inbox.body.data.items.some((item: { title: string }) => item.title === "Có hóa đơn bổ sung tiền thuốc cần thu"));

  // Bác sĩ chuyển thuốc B sang người khám tự mua trước khi thu: hóa đơn bổ sung chỉ còn thuốc A.
  const itemB = await prisma.prescriptionItem.findFirstOrThrow({ where: { prescriptionId: prescription.id, medicineId: medicineB.id } });
  const marked = await http.request(`/api/v1/dashboard/prescriptions/${prescription.id}/items/${itemB.id}/fulfillment`, {
    method: "PATCH",
    headers: dashboardHeaders(doctorCookie),
    body: { status: "OUTSIDE" },
  });
  assert.equal(marked.status, 200);
  const supplement = await prisma.invoiceSupplement.findFirstOrThrow({ where: { invoiceId }, include: { items: true } });
  assert.equal(supplement.amount, 6000);
  assert.equal(supplement.items.length, 1);

  const dispense = () =>
    http.request(`/api/v1/dashboard/pharmacy/prescriptions/${prescription.id}/dispense`, {
      method: "POST",
      headers: dashboardHeaders(pharmacistCookie),
      body: { confirmed: true, unpaidReason: "Hóa đơn đã thu, bổ sung tiền thuốc sau" },
    });
  // Chưa thu hóa đơn bổ sung: dược sĩ không cấp được, kể cả khi gửi lý do.
  const blocked = await dispense();
  assert.equal(blocked.status, 409);
  assert.equal(blocked.body.code, "PAYMENT_REQUIRED");

  // Thu tại quầy: thẻ cần mã tham chiếu, VNPAY không dùng cho hóa đơn bổ sung, người không có quyền thu bị từ chối.
  const payPath = `/api/v1/dashboard/invoices/${invoiceId}/supplements/${supplement.id}/pay`;
  assert.equal((await http.request(payPath, { method: "PATCH", headers: dashboardHeaders(pharmacistCookie), body: { paymentMethod: "CASH" } })).status, 403);
  assert.equal((await http.request(payPath, { method: "PATCH", headers: dashboardHeaders(staffCookie), body: { paymentMethod: "CARD" } })).status, 400);
  assert.equal((await http.request(payPath, { method: "PATCH", headers: dashboardHeaders(staffCookie), body: { paymentMethod: "VNPAY" } })).status, 400);
  const paid = await http.request(payPath, { method: "PATCH", headers: dashboardHeaders(staffCookie), body: { paymentMethod: "CASH" } });
  assert.equal(paid.status, 200);
  assert.equal(paid.body.data.supplements[0].status, "PAID");
  assert.equal((await http.request(payPath, { method: "PATCH", headers: dashboardHeaders(staffCookie), body: { paymentMethod: "CASH" } })).status, 409);

  // Đã thu: dược sĩ cấp được đúng dòng thuốc A; hóa đơn chính vẫn không đổi.
  const ok = await dispense();
  assert.equal(ok.status, 200);
  assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })).totalAmount, baseTotal);
  assert.equal((await prisma.prescriptionItem.findUniqueOrThrow({ where: { id: itemB.id } })).fulfillmentStatus, "OUTSIDE");
});

test("issuing a prescription adds its medicine to an unpaid invoice, and an out-of-stock line takes it off again", async () => {
  const pharmacist = await createDashboardUser("PHARMACIST", "0900000087");
  const staff = await createDashboardUser("STAFF", "0900000088");
  const pharmacistCookie = await authCookie(pharmacist.id, "PHARMACIST");
  const staffCookie = await authCookie(staff.id, "STAFF");
  const medicine = await createMedicineViaApi(pharmacistCookie, { code: "BILL-ISSUE", name: "Thuốc phát hành sau", unitPrice: 2500 });
  await receiveViaApi(pharmacistCookie, medicine.id, 10);
  const { appointment, prescription } = await createIssuedPrescription({
    code: "RX-ISSUE",
    phone: "0944000087",
    timeSlotId: fixture.slotTwo.id,
    items: [{ medicineName: "Thuốc phát hành sau", quantity: 4, medicineId: medicine.id }],
  });
  // Đơn còn nháp khi lập hóa đơn: hóa đơn chưa có tiền thuốc.
  await prisma.prescription.update({ where: { id: prescription.id }, data: { status: "DRAFT", issuedAt: null } });
  const created = await http.request(`/api/v1/dashboard/invoices/appointments/${appointment.id}`, {
    method: "POST",
    headers: dashboardHeaders(staffCookie),
    body: {},
  });
  assert.equal(created.status, 201);
  assert.equal((created.body.data.items as { type: string }[]).filter((item) => item.type === "MEDICINE").length, 0);
  const baseTotal = created.body.data.totalAmount as number;

  // Phát hành đơn: tiền thuốc (4 x 2500) vào hóa đơn ngay; phát hành lần nữa không tính hai lần.
  const doctorActor = { userId: fixture.doctorOneUser.id, role: "DOCTOR" as const };
  await PrescriptionService.issue(prescription.id, doctorActor);
  const afterIssue = await prisma.invoice.findUniqueOrThrow({ where: { id: created.body.data.id }, include: { items: true } });
  assert.equal(afterIssue.totalAmount, baseTotal + 10000);
  assert.equal(afterIssue.items.filter((item) => item.type === "MEDICINE").length, 1);
  await InvoiceMedicineService.syncMedicineLines(prescription.id, doctorActor);
  assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: created.body.data.id } })).totalAmount, baseTotal + 10000);

  // Bác sĩ đánh dấu kho hết thuốc này: dòng tiền thuốc được gỡ khỏi hóa đơn chưa thanh toán.
  const itemId = (await prisma.prescriptionItem.findFirstOrThrow({ where: { prescriptionId: prescription.id } })).id;
  const dispensed = await http.request(`/api/v1/dashboard/prescriptions/${prescription.id}/items/${itemId}/fulfillment`, {
    method: "PATCH",
    headers: dashboardHeaders(await authCookie(fixture.doctorOneUser.id, "DOCTOR")),
    body: { status: "OUT_OF_STOCK" },
  });
  assert.equal(dispensed.status, 200);
  const afterDispense = await prisma.invoice.findUniqueOrThrow({ where: { id: created.body.data.id }, include: { items: true } });
  assert.equal(afterDispense.totalAmount, baseTotal);
  assert.equal(afterDispense.finalAmount, created.body.data.finalAmount);
  assert.equal(afterDispense.items.filter((item) => item.type === "MEDICINE").length, 0);
});

test("a paid invoice records a partial refund once for medicine that was not delivered", async () => {
  const admin = await authCookie(fixture.adminUser.id, "ADMIN");
  const staff = await createDashboardUser("STAFF", "0900000091");
  const staffCookie = await authCookie(staff.id, "STAFF");
  const delivered = await prisma.medicine.create({ data: { code: "RF-OK", name: "Thuốc đã cấp", unit: "viên", unitPrice: 3000 } });
  const missing = await prisma.medicine.create({ data: { code: "RF-MISS", name: "Thuốc hết hàng", unit: "viên", unitPrice: 5000 } });

  const { appointment, prescription } = await createIssuedPrescription({
    code: "RX-REFUND",
    phone: "0944000091",
    timeSlotId: fixture.slotOne.id,
    items: [
      { medicineName: "Thuốc đã cấp", quantity: 2, medicineId: delivered.id },
      { medicineName: "Thuốc hết hàng", quantity: 1, medicineId: missing.id },
    ],
  });
  const created = await http.request(`/api/v1/dashboard/invoices/appointments/${appointment.id}`, {
    method: "POST",
    headers: dashboardHeaders(staffCookie),
    body: {},
  });
  assert.equal(created.status, 201);
  const invoiceId = created.body.data.id as string;
  const refundPath = `/api/v1/dashboard/invoices/${invoiceId}/medicine-refund`;

  // Hóa đơn chưa thanh toán: chưa có gì để hoàn.
  const beforePaid = await http.request(refundPath, { headers: dashboardHeaders(admin) });
  assert.equal(beforePaid.status, 200);
  assert.equal(beforePaid.body.data.total, 0);

  // Đã thanh toán; thuốc 1 đã cấp, thuốc 2 kho hết hàng lúc cấp.
  await prisma.invoice.update({ where: { id: invoiceId }, data: { status: "PAID", paymentMethod: "CASH", paidAt: new Date() } });
  const items = await prisma.prescriptionItem.findMany({ where: { prescriptionId: prescription.id }, orderBy: { sortOrder: "asc" } });
  await prisma.prescriptionItem.update({ where: { id: items[0].id }, data: { fulfillmentStatus: "DISPENSED", dispensedQuantity: 2 } });
  await prisma.prescriptionItem.update({ where: { id: items[1].id }, data: { fulfillmentStatus: "OUT_OF_STOCK" } });

  const listed = await http.request(refundPath, { headers: dashboardHeaders(admin) });
  assert.equal(listed.status, 200);
  assert.equal(listed.body.data.lines.length, 1);
  assert.equal(listed.body.data.lines[0].amount, 5000);
  assert.equal(listed.body.data.lines[0].reason, "OUT_OF_STOCK");
  assert.equal(listed.body.data.total, 5000);

  // Chỉ người có quyền hoàn tiền (quản trị) được xem và ghi nhận.
  assert.equal((await http.request(refundPath, { headers: dashboardHeaders(staffCookie) })).status, 403);
  assert.equal((await http.request(refundPath, { method: "POST", headers: dashboardHeaders(staffCookie), body: {} })).status, 403);

  const recorded = await http.request(refundPath, {
    method: "POST",
    headers: dashboardHeaders(admin),
    body: { note: "Hoàn tiền mặt tại quầy" },
  });
  assert.equal(recorded.status, 200);
  assert.equal(recorded.body.data.total, 5000);
  assert.equal(recorded.body.data.refundedAmount, 5000);
  const after = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { items: true } });
  assert.equal(after.status, "PAID");
  assert.equal(after.refundedAmount, 5000);
  assert.equal(after.items.filter((item) => item.refundedAt !== null).length, 1);
  assert.equal(after.items.filter((item) => item.type === "MEDICINE" && item.refundedAt === null).length, 1);
  const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "INVOICE_ADJUSTED", targetId: invoiceId } });
  assert.equal((audit.meta as { reason: string }).reason, "MEDICINE_REFUND");
  assert.equal(
    await prisma.notification.count({ where: { userId: appointment.patientId, type: "PAYMENT_REFUNDED" } }),
    1,
  );

  // Ghi nhận lần hai bị từ chối: dòng đã hoàn không được hoàn lại.
  const again = await http.request(refundPath, { method: "POST", headers: dashboardHeaders(admin), body: {} });
  assert.equal(again.status, 409);
  assert.equal(again.body.code, "NO_REFUNDABLE_MEDICINE");
  assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })).refundedAmount, 5000);
});

test("a VNPAY invoice needs a refund reference for the partial medicine refund, and then no longer refunds in full automatically", async () => {
  const admin = await authCookie(fixture.adminUser.id, "ADMIN");
  const staff = await createDashboardUser("STAFF", "0900000092");
  const staffCookie = await authCookie(staff.id, "STAFF");
  const medicine = await prisma.medicine.create({ data: { code: "RF-VNP", name: "Thuốc tự mua", unit: "viên", unitPrice: 2000 } });
  const { appointment, prescription } = await createIssuedPrescription({
    code: "RX-REFUND-VNP",
    phone: "0944000092",
    timeSlotId: fixture.slotTwo.id,
    items: [{ medicineName: "Thuốc tự mua", quantity: 3, medicineId: medicine.id }],
  });
  const created = await http.request(`/api/v1/dashboard/invoices/appointments/${appointment.id}`, {
    method: "POST",
    headers: dashboardHeaders(staffCookie),
    body: {},
  });
  assert.equal(created.status, 201);
  const invoiceId = created.body.data.id as string;
  await prisma.invoice.update({ where: { id: invoiceId }, data: { status: "PAID", paymentMethod: "VNPAY", paidAt: new Date() } });
  await prisma.prescriptionItem.updateMany({ where: { prescriptionId: prescription.id }, data: { fulfillmentStatus: "OUTSIDE" } });
  const refundPath = `/api/v1/dashboard/invoices/${invoiceId}/medicine-refund`;

  const missingReference = await http.request(refundPath, { method: "POST", headers: dashboardHeaders(admin), body: {} });
  assert.equal(missingReference.status, 400);
  assert.equal(missingReference.body.code, "REFUND_REFERENCE_REQUIRED");

  const ok = await http.request(refundPath, {
    method: "POST",
    headers: dashboardHeaders(admin),
    body: { refundReference: "VNPAY-REFUND-0001" },
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.total, 6000);

  // Đã hoàn một phần thì không hoàn tự động toàn phần qua API VNPAY (sẽ vượt số tiền còn lại).
  const full = await http.request(`/api/v1/dashboard/invoices/${invoiceId}/refund/vnpay`, {
    method: "POST",
    headers: dashboardHeaders(admin),
    body: { refundReason: "Thử hoàn toàn phần sau khi đã hoàn một phần" },
  });
  assert.equal(full.status, 409);
  assert.equal(full.body.code, "REFUND_PARTIAL_EXISTS");
});

test("the active queue lists unfinished visits by priority and leaves finished ones out", async () => {
  const staff = await createDashboardUser("STAFF", "0900000075");
  const staffCookie = await authCookie(staff.id, "STAFF");
  const confirmed = await createStoredAppointment({ status: "CONFIRMED", bookingCode: "BK-Q-CONFIRMED", phone: "0944000081", timeSlotId: fixture.slotOne.id });
  const checkedIn = await createStoredAppointment({ status: "CHECKED_IN", bookingCode: "BK-Q-CHECKEDIN", phone: "0944000082", timeSlotId: fixture.slotTwo.id });
  const queue = await http.request("/api/v1/dashboard/appointments?view=ACTIVE", { headers: dashboardHeaders(staffCookie) });
  assert.equal(queue.status, 200);
  const codes = (queue.body.data.items as { bookingCode: string }[]).map((item) => item.bookingCode);
  // Người đã đến chờ đứng trước lịch mới xác nhận, bất kể giờ khám.
  assert.deepEqual(codes, [checkedIn.bookingCode, confirmed.bookingCode]);
  assert.equal(queue.body.data.pagination.total, 2);

  // Lịch đã xong rời khỏi hàng đợi.
  await prisma.appointment.update({ where: { id: confirmed.id }, data: { status: "COMPLETED" } });
  const after = await http.request("/api/v1/dashboard/appointments?view=ACTIVE", { headers: dashboardHeaders(staffCookie) });
  assert.deepEqual((after.body.data.items as { bookingCode: string }[]).map((item) => item.bookingCode), [checkedIn.bookingCode]);
});
