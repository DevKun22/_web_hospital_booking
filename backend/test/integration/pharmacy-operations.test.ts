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

test("pharmacy schema enforces non-negative stock and consistent ledger rows", async () => {
  const pharmacist = await prisma.user.create({
    data: {
      fullName: "Phase Pharmacist",
      phone: "0900000009",
      role: "PHARMACIST",
      isPhoneVerified: true,
    },
  });
  const medicine = await prisma.medicine.create({
    data: { code: "PARA500", name: "Paracetamol 500mg", unit: "viên", stockQuantity: 10 },
  });
  const movement = (data: Record<string, unknown>) =>
    prisma.stockMovement.create({
      data: {
        medicineId: medicine.id,
        actorId: pharmacist.id,
        type: "RECEIPT",
        quantity: 5,
        balanceAfter: 15,
        ...data,
      } as never,
    });

  // Stock can never go negative, even through a direct write.
  await assert.rejects(
    prisma.medicine.update({ where: { id: medicine.id }, data: { stockQuantity: -1 } }),
    /Medicine_stockQuantity_nonnegative|check constraint/i,
  );
  // Medicine codes are unique.
  await assert.rejects(
    prisma.medicine.create({ data: { code: "PARA500", name: "Duplicate", unit: "viên" } }),
    /Unique constraint|PARA500|code/i,
  );

  // Ledger rows must match their type.
  await assert.rejects(movement({ quantity: 0 }), /quantity_nonzero|check constraint/i);
  await assert.rejects(movement({ type: "RECEIPT", quantity: -5 }), /sign_matches_type|check constraint/i);
  await assert.rejects(
    movement({ type: "DISPENSE", quantity: -3, balanceAfter: 7, prescriptionItemId: null }),
    /dispense_has_item|check constraint/i,
  );
  await assert.rejects(
    movement({ type: "ADJUSTMENT", quantity: -2, balanceAfter: 8, reason: "   " }),
    /adjustment_has_reason|check constraint/i,
  );

  const receipt = await movement({});
  assert.equal(receipt.quantity, 5);

  // The ledger is append-only.
  await assert.rejects(
    prisma.stockMovement.update({ where: { id: receipt.id }, data: { reason: "edited" } }),
    /append-only|chỉ thêm dòng/i,
  );
  await assert.rejects(
    prisma.stockMovement.delete({ where: { id: receipt.id } }),
    /append-only|chỉ thêm dòng/i,
  );

  // Referenced medicines and actors cannot be deleted.
  await assert.rejects(prisma.medicine.delete({ where: { id: medicine.id } }));
  await assert.rejects(prisma.user.delete({ where: { id: pharmacist.id } }));
});

test("new log actions and prescription dispense defaults are available", async () => {
  const appointment = await createStoredAppointment({ status: "COMPLETED" });

  for (const action of [
    "MEDICAL_RESULT_UPDATED",
    "MEDICAL_RESULT_PUBLISHED",
    "LAB_RESULT_CHANGED",
    "PRESCRIPTION_ISSUED",
    "PRESCRIPTION_CANCELLED",
    "PRESCRIPTION_DISPENSED",
  ] as const) {
    await prisma.appointmentLog.create({
      data: { appointmentId: appointment.id, action, note: "schema check" },
    });
  }
  assert.equal(
    await prisma.appointmentLog.count({ where: { appointmentId: appointment.id } }),
    6,
  );

  const record = await prisma.medicalRecord.create({
    data: {
      recordCode: "REC-SCHEMA-1",
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      doctorId: fixture.doctorOne.id,
    },
  });
  const prescription = await prisma.prescription.create({
    data: {
      prescriptionCode: "RX-SCHEMA-1",
      medicalRecordId: record.id,
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      doctorId: fixture.doctorOne.id,
      items: { create: [{ medicineName: "Thuốc mua ngoài", quantity: 2 }] },
    },
    include: { items: true },
  });

  assert.equal(prescription.dispenseStatus, "NOT_DISPENSED");
  assert.equal(prescription.dispensedAt, null);
  assert.equal(prescription.items[0].medicineId, null);
  assert.equal(prescription.items[0].dispensedQuantity, 0);
});

test("pharmacy endpoints are limited to the pharmacist role", async () => {
  const pharmacist = await createDashboardUser("PHARMACIST", "0900000012");
  const staff = await createDashboardUser("STAFF", "0900000011");
  const pharmacistCookie = await authCookie(pharmacist.id, "PHARMACIST");
  const request = (path: string, cookie: string, method = "GET", body?: unknown) =>
    http.request(`/api/v1/dashboard/pharmacy${path}`, {
      method,
      headers: dashboardHeaders(cookie),
      body,
    });

  for (const cookie of [
    await authCookie(staff.id, "STAFF"),
    await authCookie(fixture.doctorOneUser.id, "DOCTOR"),
    await authCookie(fixture.adminUser.id, "ADMIN"),
  ]) {
    assert.equal((await request("/medicines", cookie)).status, 403);
    assert.equal((await request("/prescriptions", cookie)).status, 403);
    assert.equal(
      (await request("/medicines", cookie, "POST", { code: "X1", name: "X", unit: "viên" })).status,
      403,
    );
  }
  assert.equal((await request("/medicines", pharmacistCookie)).status, 200);
  assert.equal((await request("/prescriptions", pharmacistCookie)).status, 200);
});

test("stock changes only through the ledger and never goes negative", async () => {
  const pharmacist = await createDashboardUser("PHARMACIST", "0900000012");
  const cookie = await authCookie(pharmacist.id, "PHARMACIST");
  const medicine = await createMedicineViaApi(cookie, { code: "para500", name: "Paracetamol 500mg", minStock: 20 });
  assert.equal(medicine.code, "PARA500");
  assert.equal(medicine.stockQuantity, 0);

  const duplicate = await http.request("/api/v1/dashboard/pharmacy/medicines", {
    method: "POST",
    headers: dashboardHeaders(cookie),
    body: { code: "PARA500", name: "Trùng", unit: "viên" },
  });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.code, "MEDICINE_CODE_EXISTS");

  // Sửa thuốc không đụng tới tồn.
  const edited = await http.request(`/api/v1/dashboard/pharmacy/medicines/${medicine.id}`, {
    method: "PATCH",
    headers: dashboardHeaders(cookie),
    body: { name: "Paracetamol 500mg (hộp 100)", stockQuantity: 999 },
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.data.stockQuantity, 0);

  assert.equal((await receiveViaApi(cookie, medicine.id, 50)).stockQuantity, 50);

  const adjust = (delta: number, reason?: string) =>
    http.request(`/api/v1/dashboard/pharmacy/medicines/${medicine.id}/adjustments`, {
      method: "POST",
      headers: dashboardHeaders(cookie),
      body: { delta, reason },
    });
  assert.equal((await adjust(-5)).status, 400);
  assert.equal((await adjust(-5, "Kiểm kê thiếu")).body.data.stockQuantity, 45);
  const tooMuch = await adjust(-100, "Hủy thuốc hết hạn");
  assert.equal(tooMuch.status, 409);
  assert.equal(tooMuch.body.code, "INSUFFICIENT_STOCK");
  assert.equal((await adjust(0, "Không đổi")).status, 400);

  const negativeReceipt = await http.request(
    `/api/v1/dashboard/pharmacy/medicines/${medicine.id}/receipts`,
    { method: "POST", headers: dashboardHeaders(cookie), body: { quantity: -3 } },
  );
  assert.equal(negativeReceipt.status, 400);

  // Tồn luôn bằng tổng sổ kho; sổ kho chỉ thêm, không sửa hay xóa.
  const movements = await prisma.stockMovement.findMany({
    where: { medicineId: medicine.id },
    orderBy: { createdAt: "asc" },
  });
  assert.deepEqual(
    movements.map((item) => [item.type, item.quantity, item.balanceAfter]),
    [
      ["RECEIPT", 50, 50],
      ["ADJUSTMENT", -5, 45],
    ],
  );
  await assert.rejects(() =>
    prisma.stockMovement.update({ where: { id: movements[0].id }, data: { quantity: 999 } }),
  );
  await assert.rejects(() => prisma.stockMovement.delete({ where: { id: movements[0].id } }));

  const low = await http.request("/api/v1/dashboard/pharmacy/medicines?lowStock=true", {
    headers: dashboardHeaders(cookie),
  });
  assert.equal(low.body.data.items.length, 0);
  await adjust(-30, "Hủy thuốc hết hạn");
  const lowAfter = await http.request("/api/v1/dashboard/pharmacy/medicines?lowStock=true", {
    headers: dashboardHeaders(cookie),
  });
  assert.deepEqual(lowAfter.body.data.items.map((item: { code: string }) => item.code), ["PARA500"]);

  const history = await http.request(`/api/v1/dashboard/pharmacy/medicines/${medicine.id}/movements`, {
    headers: dashboardHeaders(cookie),
  });
  assert.equal(history.status, 200);
  assert.equal(history.body.data.items.length, 3);
});

test("dispensing deducts stock for the whole prescription or not at all", async () => {
  const pharmacist = await createDashboardUser("PHARMACIST", "0900000012");
  const cookie = await authCookie(pharmacist.id, "PHARMACIST");
  const medicineA = await createMedicineViaApi(cookie, { code: "MED-A", name: "Thuốc A" });
  const medicineB = await createMedicineViaApi(cookie, { code: "MED-B", name: "Thuốc B" });
  await receiveViaApi(cookie, medicineA.id, 10);
  await receiveViaApi(cookie, medicineB.id, 3);

  const { appointment, prescription } = await createIssuedPrescription({
    code: "RX-DISPENSE",
    phone: "0911111111",
    timeSlotId: fixture.slotTwo.id,
    items: [
      { medicineName: "Thuốc A", quantity: 6, medicineId: medicineA.id },
      { medicineName: "Thuốc B", quantity: 5, medicineId: medicineB.id },
      { medicineName: "Thuốc mua ngoài", quantity: 2 },
    ],
  });
  const dispense = (body: unknown) =>
    http.request(`/api/v1/dashboard/pharmacy/prescriptions/${prescription.id}/dispense`, {
      method: "POST",
      headers: dashboardHeaders(cookie),
      body,
    });
  const stock = async (id: string) =>
    (await prisma.medicine.findUniqueOrThrow({ where: { id } })).stockQuantity;

  // Hàng đợi chỉ có đơn đã phát hành chưa cấp.
  const queue = await http.request("/api/v1/dashboard/pharmacy/prescriptions", {
    headers: dashboardHeaders(cookie),
  });
  assert.deepEqual(
    queue.body.data.items.map((item: { prescriptionCode: string }) => item.prescriptionCode),
    ["RX-DISPENSE"],
  );

  // Chưa tick xác nhận kiểm tra: từ chối.
  const unconfirmed = await dispense({ confirmed: false });
  assert.equal(unconfirmed.status, 400);
  assert.equal(unconfirmed.body.code, "DISPENSE_CONFIRMATION_REQUIRED");

  // Thuốc B thiếu (cần 5, còn 3): cả đơn không được cấp, thuốc A cũng không bị trừ.
  const short = await dispense({ confirmed: true });
  assert.equal(short.status, 409);
  assert.equal(short.body.code, "INSUFFICIENT_STOCK");
  assert.equal(await stock(medicineA.id), 10);
  assert.equal(await stock(medicineB.id), 3);
  const untouched = await prisma.prescription.findUniqueOrThrow({ where: { id: prescription.id } });
  assert.equal(untouched.dispenseStatus, "NOT_DISPENSED");
  assert.equal(untouched.dispensedById, null);
  assert.equal(
    await prisma.stockMovement.count({ where: { type: "DISPENSE" } }),
    0,
  );

  await receiveViaApi(cookie, medicineB.id, 5);
  const ok = await dispense({ confirmed: true, note: "Đã đối chiếu dị ứng" });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.dispenseStatus, "DISPENSED");
  assert.equal(await stock(medicineA.id), 4);
  assert.equal(await stock(medicineB.id), 3);

  const dispensed = await prisma.prescription.findUniqueOrThrow({
    where: { id: prescription.id },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  assert.equal(dispensed.dispensedById, pharmacist.id);
  assert.equal(dispensed.dispenseNote, "Đã đối chiếu dị ứng");
  assert.deepEqual(
    dispensed.items.map((item) => item.dispensedQuantity),
    [6, 5, 0],
  );
  const movements = await prisma.stockMovement.findMany({
    where: { type: "DISPENSE" },
    orderBy: { quantity: "desc" },
  });
  assert.deepEqual(
    movements.map((item) => [item.quantity, item.balanceAfter, item.actorId]),
    [
      [-5, 3, pharmacist.id],
      [-6, 4, pharmacist.id],
    ],
  );

  // Dấu vết lâm sàng và thông báo cho người khám.
  assert.equal(
    await prisma.appointmentLog.count({
      where: { appointmentId: appointment.id, action: "PRESCRIPTION_DISPENSED" },
    }),
    1,
  );
  assert.equal(
    await prisma.notification.count({
      where: { userId: appointment.patientId, type: "PRESCRIPTION_DISPENSED" },
    }),
    1,
  );

  // Cấp lần hai bị chặn, đơn đã cấp không hủy được và rời hàng đợi.
  const again = await dispense({ confirmed: true });
  assert.equal(again.status, 409);
  assert.equal(again.body.code, "ALREADY_DISPENSED");
  assert.equal(await stock(medicineA.id), 4);
  await assert.rejects(
    () => PrescriptionService.cancel(prescription.id, { userId: fixture.adminUser.id, role: "ADMIN" }),
    (error: { code?: string }) => error.code === "PRESCRIPTION_DISPENSED",
  );
  const emptyQueue = await http.request("/api/v1/dashboard/pharmacy/prescriptions", {
    headers: dashboardHeaders(cookie),
  });
  assert.equal(emptyQueue.body.data.items.length, 0);
  const done = await http.request(
    "/api/v1/dashboard/pharmacy/prescriptions?dispenseStatus=DISPENSED",
    { headers: dashboardHeaders(cookie) },
  );
  assert.equal(done.body.data.items.length, 1);
});

test("two pharmacists dispensing the same prescription deduct stock once", async () => {
  const pharmacist = await createDashboardUser("PHARMACIST", "0900000012");
  const cookie = await authCookie(pharmacist.id, "PHARMACIST");
  const medicine = await createMedicineViaApi(cookie, { code: "MED-C", name: "Thuốc C" });
  await receiveViaApi(cookie, medicine.id, 10);

  // Dòng đơn chưa gắn thuốc kho: dược sĩ chọn thuốc khi cấp.
  const { prescription } = await createIssuedPrescription({
    code: "RX-RACE",
    phone: "0922222222",
    timeSlotId: fixture.slotOne.id,
    items: [{ medicineName: "Thuốc C (gõ tay)", quantity: 4 }],
  });
  const body = {
    confirmed: true,
    lines: [{ itemId: prescription.items[0].id, medicineId: medicine.id }],
  };
  const responses = await Promise.all(
    [1, 2].map(() =>
      http.request(`/api/v1/dashboard/pharmacy/prescriptions/${prescription.id}/dispense`, {
        method: "POST",
        headers: dashboardHeaders(cookie),
        body,
      }),
    ),
  );
  responses.sort((left, right) => left.status - right.status);
  assert.equal(responses[0].status, 200);
  assert.equal(responses[1].status, 409);

  assert.equal(
    (await prisma.medicine.findUniqueOrThrow({ where: { id: medicine.id } })).stockQuantity,
    6,
  );
  assert.equal(await prisma.stockMovement.count({ where: { type: "DISPENSE" } }), 1);
  const item = await prisma.prescriptionItem.findUniqueOrThrow({
    where: { id: prescription.items[0].id },
  });
  assert.equal(item.medicineId, medicine.id);
  assert.equal(item.dispensedQuantity, 4);
});

test("batches: receipts by lot, FEFO dispensing and expired stock never dispensed", async () => {
  const pharmacist = await createDashboardUser("PHARMACIST", "0900000012");
  const cookie = await authCookie(pharmacist.id, "PHARMACIST");
  const medicine = await createMedicineViaApi(cookie, { code: "MED-LOT", name: "Thuốc theo lô" });
  const call = (path: string, method = "GET", body?: unknown) =>
    http.request(`/api/v1/dashboard/pharmacy${path}`, { method, headers: dashboardHeaders(cookie), body });
  const receive = (body: Record<string, unknown>) => call(`/medicines/${medicine.id}/receipts`, "POST", body);

  // Khai thiếu một nửa, lô đã hết hạn, và cùng số lô khác hạn dùng đều bị từ chối.
  assert.equal((await receive({ quantity: 5, batchNumber: "L0" })).body.code, "BATCH_FIELDS_INCOMPLETE");
  assert.equal(
    (await receive({ quantity: 5, batchNumber: "L0", expiryDate: isoDateFromToday(-1) })).body.code,
    "BATCH_ALREADY_EXPIRED",
  );
  assert.equal((await receive({ quantity: 10, batchNumber: "L1", expiryDate: isoDateFromToday(400) })).status, 201);
  assert.equal((await receive({ quantity: 5, batchNumber: "L2", expiryDate: isoDateFromToday(100) })).status, 201);
  assert.equal(
    (await receive({ quantity: 1, batchNumber: "L1", expiryDate: isoDateFromToday(401) })).body.code,
    "BATCH_EXPIRY_MISMATCH",
  );
  // Nhập thêm cùng lô cùng hạn thì cộng dồn.
  assert.equal((await receive({ quantity: 2, batchNumber: "L1", expiryDate: isoDateFromToday(400) })).status, 201);

  const batches = await call(`/medicines/${medicine.id}/batches`);
  assert.equal(batches.status, 200);
  assert.deepEqual(
    batches.body.data.items.map((item: { batchNumber: string; quantity: number }) => [item.batchNumber, item.quantity]),
    [["L2", 5], ["L1", 12]],
  );
  assert.equal(batches.body.data.summary.stockQuantity, 17);

  // Lô đã hết hạn trong kho (giả lập lô nhập từ trước): không tính vào tồn cấp được.
  const expired = await prisma.stockBatch.create({
    data: {
      medicineId: medicine.id,
      batchNumber: "OLD",
      expiryDate: new Date(`${isoDateFromToday(-10)}T00:00:00.000Z`),
      receivedQuantity: 4,
      quantity: 4,
    },
  });
  await prisma.medicine.update({ where: { id: medicine.id }, data: { stockQuantity: { increment: 4 } } });
  const listed = await call(`/medicines?limit=100`);
  const row = listed.body.data.items.find((item: { id: string }) => item.id === medicine.id);
  assert.equal(row.stockQuantity, 21);
  assert.equal(row.sellableQuantity, 17);
  assert.equal(row.expiredQuantity, 4);
  assert.equal(row.nearestExpiry, isoDateFromToday(100));

  const alerts = await call("/medicines/expiry-alerts");
  assert.equal(alerts.status, 200);
  assert.deepEqual(
    alerts.body.data.items.map((item: { batchNumber: string; status: string }) => [item.batchNumber, item.status]),
    [["OLD", "EXPIRED"]],
  );

  // Cần 18 nhưng chỉ có 17 còn hạn: cả đơn bị từ chối, không lô nào bị trừ.
  const tooMuch = await createIssuedPrescription({
    code: "RX-LOT-BIG",
    phone: "0933333331",
    timeSlotId: fixture.slotOne.id,
    items: [{ medicineName: "Thuốc theo lô", quantity: 18, medicineId: medicine.id }],
  });
  const refused = await call(`/prescriptions/${tooMuch.prescription.id}/dispense`, "POST", { confirmed: true });
  assert.equal(refused.status, 409);
  assert.equal(refused.body.code, "INSUFFICIENT_STOCK");
  assert.equal((await prisma.medicine.findUniqueOrThrow({ where: { id: medicine.id } })).stockQuantity, 21);

  // Cần 8: lấy hết lô hết hạn sớm (L2 còn 5) rồi lấy 3 từ lô sau (L1).
  const small = await createIssuedPrescription({
    code: "RX-LOT-SMALL",
    phone: "0933333332",
    timeSlotId: fixture.slotTwo.id,
    items: [{ medicineName: "Thuốc theo lô", quantity: 8, medicineId: medicine.id }],
  });
  const ok = await call(`/prescriptions/${small.prescription.id}/dispense`, "POST", { confirmed: true });
  assert.equal(ok.status, 200);
  const after = await prisma.stockBatch.findMany({ where: { medicineId: medicine.id }, orderBy: { batchNumber: "asc" } });
  assert.deepEqual(
    after.map((item) => [item.batchNumber, item.quantity]),
    [["L1", 9], ["L2", 0], ["OLD", 4]],
  );
  const slices = await prisma.stockMovement.findMany({
    where: { type: "DISPENSE" },
    orderBy: { balanceAfter: "desc" },
    include: { batch: true },
  });
  assert.deepEqual(
    slices.map((item) => [item.batch?.batchNumber, item.quantity, item.balanceAfter]),
    [["L2", -5, 16], ["L1", -3, 13]],
  );
  assert.equal((await prisma.medicine.findUniqueOrThrow({ where: { id: medicine.id } })).stockQuantity, 13);

  // Hủy lô hết hạn bằng điều chỉnh theo lô; quá số còn lại thì bị từ chối.
  const tooBig = await call(`/medicines/${medicine.id}/adjustments`, "POST", { delta: -5, reason: "Hủy", batchId: expired.id });
  assert.equal(tooBig.status, 409);
  assert.equal(tooBig.body.code, "INSUFFICIENT_BATCH_STOCK");
  const written = await call(`/medicines/${medicine.id}/adjustments`, "POST", {
    delta: -4,
    reason: "Hủy thuốc hết hạn",
    batchId: expired.id,
  });
  assert.equal(written.status, 201);
  assert.equal(written.body.data.stockQuantity, 9);
  assert.equal((await prisma.stockBatch.findUniqueOrThrow({ where: { id: expired.id } })).quantity, 0);
});

test("pharmacy CSV receipts can carry lot and expiry; exports include them", async () => {
  const pharmacist = await createDashboardUser("PHARMACIST", "0900000413");
  const cookie = await authCookie(pharmacist.id, "PHARMACIST");
  const send = (csv: string, apply: boolean) =>
    http.request("/api/v1/dashboard/pharmacy/import/receipts", {
      method: "POST",
      headers: dashboardHeaders(cookie),
      body: { csv, apply },
    });
  const plus = (days: number) => new Date(Date.now() + 7 * 3_600_000 + days * 86_400_000);
  const iso = (days: number) => plus(days).toISOString().slice(0, 10);
  const vn = (days: number) => iso(days).split("-").reverse().join("/");

  const medicine = await prisma.medicine.create({
    data: { code: "LOT-CSV", name: "Thuốc lô CSV", unit: "viên", stockQuantity: 5, minStock: 1 },
  });

  // Cùng thuốc nhiều lô trong một tệp là hợp lệ; ngày kiểu Việt Nam và ISO đều nhận.
  const csv = `Mã thuốc,Số lượng,Số lô,Hạn dùng,Lý do\r\nLOT-CSV,10,A1,${vn(200)},Phiếu 01\r\nLOT-CSV,6,B2,${iso(90)},Phiếu 01\r\n`;
  const preview = await send(csv, false);
  assert.equal(preview.status, 200, JSON.stringify(preview.body));
  assert.equal(preview.body.data.summary.errors, 0);
  assert.equal(preview.body.data.rows[0].batchNumber, "A1");
  assert.equal(preview.body.data.rows[0].expiryDate, iso(200));
  assert.equal(await prisma.stockBatch.count(), 0);

  // Lỗi: khai thiếu một nửa, hạn đã qua, ngày không có thật, lặp lô trong tệp.
  const bad = await send(
    `Mã thuốc,Số lượng,Số lô,Hạn dùng\r\nLOT-CSV,1,C3,\r\nLOT-CSV,1,D4,${vn(-1)}\r\nLOT-CSV,1,E5,31/02/2030\r\nLOT-CSV,1,F6,${vn(50)}\r\nLOT-CSV,1,f6,${vn(50)}\r\n`,
    true,
  );
  assert.equal(bad.body.data.applied, false);
  assert.deepEqual(
    bad.body.data.rows.map((row: { errors: string[] }) => row.errors.length > 0),
    [true, true, true, false, true],
  );

  const applied = await send(csv, true);
  assert.equal(applied.body.data.applied, true);
  assert.equal(applied.body.data.summary.totalQuantity, 16);
  const batches = await prisma.stockBatch.findMany({ where: { medicineId: medicine.id }, orderBy: { batchNumber: "asc" } });
  assert.deepEqual(batches.map((item) => [item.batchNumber, item.quantity]), [["A1", 10], ["B2", 6]]);
  assert.equal((await prisma.medicine.findUniqueOrThrow({ where: { id: medicine.id } })).stockQuantity, 21);

  // Cùng số lô với hạn dùng khác bị báo ngay ở bước xem trước; cùng hạn thì cộng dồn.
  const mismatch = await send(`Mã thuốc,Số lượng,Số lô,Hạn dùng\r\nLOT-CSV,1,A1,${iso(201)}\r\n`, false);
  assert.equal(mismatch.body.data.summary.errors, 1);
  assert.equal((await send(`Mã thuốc,Số lượng,Số lô,Hạn dùng\r\nLOT-CSV,4,A1,${iso(200)}\r\n`, true)).body.data.applied, true);
  assert.equal((await prisma.stockBatch.findFirstOrThrow({ where: { batchNumber: "A1" } })).quantity, 14);

  // Xuất tồn kho có hạn dùng gần nhất; xuất sổ kho có số lô.
  const download = async (path: string) => {
    const response = await fetch(`${http.baseUrl}${path}`, { headers: dashboardHeaders(cookie) });
    return { status: response.status, text: await response.text() };
  };
  const inventory = await download("/api/v1/dashboard/pharmacy/medicines/export");
  assert.equal(inventory.status, 200);
  assert.ok(inventory.text.includes("Hạn dùng gần nhất"));
  assert.ok(inventory.text.includes(iso(90)));
  const movements = await download("/api/v1/dashboard/pharmacy/movements/export");
  assert.equal(movements.status, 200);
  assert.ok(movements.text.includes("Số lô"));
  assert.ok(movements.text.includes("B2"));
});

test("pharmacy CSV import previews first, applies all-or-nothing and never overwrites stock", async () => {
  const pharmacist = await createDashboardUser("PHARMACIST", "0900000411");
  const cookie = await authCookie(pharmacist.id, "PHARMACIST");
  const staff = await createDashboardUser("STAFF", "0900000412");
  const staffCookie = await authCookie(staff.id, "STAFF");

  const send = (kind: "catalog" | "receipts", csv: string, apply: boolean, who = cookie) =>
    http.request(`/api/v1/dashboard/pharmacy/import/${kind}`, {
      method: "POST",
      headers: dashboardHeaders(who),
      body: { csv, apply },
    });

  await prisma.medicine.create({
    data: { code: "IMP-OLD", name: "Thuốc cũ", unit: "viên", stockQuantity: 7, minStock: 2 },
  });

  // Danh mục: xem trước không ghi gì; có dòng lỗi thì không áp dụng dù apply=true.
  const catalogCsv =
    "\uFEFFMã thuốc,Tên thuốc,Đơn vị,Hàm lượng,Mức tối thiểu\r\n" +
    "imp-new,Thuốc mới,viên,500mg,20\r\n" +
    "IMP-OLD,Thuốc cũ đổi tên,,,\r\n";
  const preview = await send("catalog", catalogCsv, false);
  assert.equal(preview.status, 200, JSON.stringify(preview.body));
  assert.equal(preview.body.data.applied, false);
  assert.deepEqual(
    [preview.body.data.summary.create, preview.body.data.summary.update, preview.body.data.summary.errors],
    [1, 1, 0],
  );
  assert.equal(await prisma.medicine.count({ where: { code: "IMP-NEW" } }), 0);

  const bad = await send("catalog", catalogCsv + "IMP-BAD,,,,abc\r\nimp-new,Lặp,viên,,\r\n", true);
  assert.equal(bad.status, 200);
  assert.equal(bad.body.data.applied, false);
  assert.equal(bad.body.data.summary.errors, 2);
  assert.equal(await prisma.medicine.count({ where: { code: "IMP-NEW" } }), 0);

  const applied = await send("catalog", catalogCsv, true);
  assert.equal(applied.body.data.applied, true);
  const created = await prisma.medicine.findUniqueOrThrow({ where: { code: "IMP-NEW" } });
  assert.equal(created.name, "Thuốc mới");
  assert.equal(created.minStock, 20);
  assert.equal(created.stockQuantity, 0);
  const updated = await prisma.medicine.findUniqueOrThrow({ where: { code: "IMP-OLD" } });
  assert.equal(updated.name, "Thuốc cũ đổi tên");
  assert.equal(updated.minStock, 2); // ô trống giữ nguyên
  assert.equal(updated.stockQuantity, 7); // tệp danh mục không bao giờ đổi tồn

  // Nhập kho: đi qua sổ kho; một dòng sai thì không dòng nào được nhập.
  const failing = await send("receipts", "Mã thuốc,Số lượng\nIMP-OLD,10\nKHONG-CO,5\n", true);
  assert.equal(failing.body.data.applied, false);
  assert.equal(failing.body.data.rows[1].errors.length, 1);
  assert.equal((await prisma.medicine.findUniqueOrThrow({ where: { code: "IMP-OLD" } })).stockQuantity, 7);

  const receipts = await send("receipts", "Mã thuốc;Số lượng;Lý do\nIMP-OLD;10;Phiếu 01\nIMP-NEW;4;\n", true);
  assert.equal(receipts.status, 200, JSON.stringify(receipts.body));
  assert.equal(receipts.body.data.applied, true);
  assert.equal(receipts.body.data.summary.totalQuantity, 14);
  assert.equal((await prisma.medicine.findUniqueOrThrow({ where: { code: "IMP-OLD" } })).stockQuantity, 17);
  const movement = await prisma.stockMovement.findFirstOrThrow({
    where: { medicine: { code: "IMP-OLD" }, type: "RECEIPT" },
  });
  assert.equal(movement.quantity, 10);
  assert.equal(movement.balanceAfter, 17);
  assert.equal(movement.reason, "Phiếu 01");

  // Số âm, số thập phân và thuốc lặp trong tệp bị từ chối.
  const invalid = await send("receipts", "Mã thuốc,Số lượng\nIMP-OLD,-3\nIMP-OLD,1.5\n", false);
  assert.equal(invalid.body.data.summary.errors, 2);

  // Phân quyền và dấu vết kiểm toán (không ghi nội dung tệp).
  assert.equal((await send("catalog", catalogCsv, false, staffCookie)).status, 403);
  assert.equal((await send("receipts", "Mã thuốc,Số lượng\nIMP-OLD,1\n", true, staffCookie)).status, 403);
  assert.equal((await send("catalog", "Tên thuốc\nX\n", false)).status, 400);

  const audits = await prisma.auditLog.findMany({ where: { action: "DATA_IMPORTED" }, orderBy: { createdAt: "asc" } });
  assert.deepEqual(audits.map((row) => row.targetType), ["MEDICINE_CATALOG", "STOCK_RECEIPTS"]);
  assert.equal((audits[1].meta as { totalQuantity: number }).totalQuantity, 14);
});

test("pharmacy alerts reach pharmacists once a day and broadcast needs its own permission", async () => {
  const { default: PharmacyService } = await import("../../src/services/pharmacy.service.js");
  const pharmacist = await createDashboardUser("PHARMACIST", "0900000041");
  const staff = await createDashboardUser("STAFF", "0900000042");
  const pharmacistCookie = await authCookie(pharmacist.id, "PHARMACIST");
  const staffCookie = await authCookie(staff.id, "STAFF");
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");
  const get = (path: string, cookie: string) =>
    http.request(path, { headers: dashboardHeaders(cookie) });

  await prisma.medicine.create({
    data: { code: "LOWSTOCK1", name: "Thuốc sắp hết", unit: "viên", stockQuantity: 3, minStock: 10 },
  });
  await PharmacyService.notifyStockAlerts();
  await PharmacyService.notifyStockAlerts();
  const inbox = await get("/api/v1/dashboard/inbox", pharmacistCookie);
  const lowStock = inbox.body.data.items.filter((item: { title: string }) => item.title === "Thuốc sắp hết");
  assert.equal(lowStock.length, 1);
  assert.match(lowStock[0].body, /còn 3 viên/);
  // Chỉ dược sĩ nhận; quản trị và nhân viên không.
  assert.equal((await get("/api/v1/dashboard/inbox", adminCookie)).body.data.items.length, 0);
  assert.equal((await get("/api/v1/dashboard/inbox", staffCookie)).body.data.items.length, 0);

  // Gửi thông báo cần quyền riêng: nhân viên tiếp nhận được (mặc định), dược sĩ thì không.
  const payload = { title: "Thông báo thử quyền", body: "Nội dung kiểm tra quyền gửi thông báo.", audience: "ROLE_DOCTOR" };
  const asPharmacist = await http.request("/api/v1/dashboard/notifications", {
    method: "POST",
    headers: dashboardHeaders(pharmacistCookie),
    body: payload,
  });
  assert.equal(asPharmacist.status, 403);
  const asStaff = await http.request("/api/v1/dashboard/notifications", {
    method: "POST",
    headers: dashboardHeaders(staffCookie),
    body: payload,
  });
  assert.equal(asStaff.status, 201);
});
