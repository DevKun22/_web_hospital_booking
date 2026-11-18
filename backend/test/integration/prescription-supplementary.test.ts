import { InvoiceMedicineService, InvoiceService, PrescriptionService, assert, authCookie, createDashboardUser, createMedicineViaApi, createStoredAppointment, dashboardHeaders, fixture, http, prisma, receiveViaApi, test } from "./support/context.js";

// Đơn bổ sung: một hồ sơ khám có thể có nhiều đơn thuốc. Đơn đã phát hành là bất biến; thêm thuốc sau đó là đơn mới.
// Mỗi hồ sơ chỉ có một đơn nháp cùng lúc; thuốc mua ngoài (bác sĩ đánh dấu hoặc ngoài danh mục) không trừ kho, không tính tiền.

const doctorActor = () => ({ userId: fixture.doctorOneUser.id, role: "DOCTOR" as const });

const createRecord = async (bookingCode: string, phone: string, timeSlotId?: string) => {
  const appointment = await createStoredAppointment({ status: "COMPLETED", bookingCode, phone, timeSlotId });
  const record = await prisma.medicalRecord.create({
    data: {
      recordCode: `REC-${bookingCode}`,
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      status: "DRAFT",
    },
  });
  return { appointment, record };
};

const itemStatuses = async (prescriptionId: string) =>
  (await prisma.prescriptionItem.findMany({ where: { prescriptionId }, orderBy: { sortOrder: "asc" } })).map(
    (item) => item.fulfillmentStatus,
  );

test("a record can get a supplementary prescription once the first is issued, but never two drafts", async () => {
  const pharmacist = await createDashboardUser("PHARMACIST", "0900000501");
  const pharmacistCookie = await authCookie(pharmacist.id, "PHARMACIST");
  const medicine = await createMedicineViaApi(pharmacistCookie, { code: "SUP-A", name: "Thuốc A", unitPrice: 1000 });
  await receiveViaApi(pharmacistCookie, medicine.id, 50);
  const { record } = await createRecord("SUP-RECORD-1", "0955700001", fixture.slotTwo.id);
  const line = { medicineName: "Thuốc A", quantity: 2, medicineId: medicine.id };

  const first = await PrescriptionService.createForMedicalRecord(record.id, { items: [line] }, doctorActor());
  await assert.rejects(
    () => PrescriptionService.createForMedicalRecord(record.id, { items: [line] }, doctorActor()),
    (error: { statusCode?: number; code?: string }) => error.statusCode === 409 && error.code === "PRESCRIPTION_DRAFT_EXISTS",
  );

  await PrescriptionService.issue(first.id, doctorActor());
  const second = await PrescriptionService.createForMedicalRecord(record.id, { items: [line] }, doctorActor());
  assert.notEqual(second.id, first.id);
  await assert.rejects(
    () => PrescriptionService.createForMedicalRecord(record.id, { items: [line] }, doctorActor()),
    (error: { code?: string }) => error.code === "PRESCRIPTION_DRAFT_EXISTS",
  );

  await PrescriptionService.issue(second.id, doctorActor());
  assert.equal(await prisma.prescription.count({ where: { medicalRecordId: record.id } }), 2);
  const third = await PrescriptionService.createForMedicalRecord(record.id, {}, doctorActor());
  assert.equal(third.status, "DRAFT");
});

test("the database refuses two drafts for one record even without the service check", async () => {
  const { appointment, record } = await createRecord("SUP-RECORD-2", "0955700002", fixture.slotTwo.id);
  const base = {
    medicalRecordId: record.id,
    appointmentId: appointment.id,
    patientId: appointment.patientId,
    doctorId: appointment.doctorId,
    status: "DRAFT" as const,
  };
  await prisma.prescription.create({ data: { ...base, prescriptionCode: "SUP-DRAFT-1" } });
  await assert.rejects(() => prisma.prescription.create({ data: { ...base, prescriptionCode: "SUP-DRAFT-2" } }));
});

test("items without a stock medicine, or marked by the doctor, are bought outside and never billed", async () => {
  const pharmacist = await createDashboardUser("PHARMACIST", "0900000502");
  const pharmacistCookie = await authCookie(pharmacist.id, "PHARMACIST");
  const stocked = await createMedicineViaApi(pharmacistCookie, { code: "SUP-B", name: "Thuốc B", unitPrice: 2000 });
  const other = await createMedicineViaApi(pharmacistCookie, { code: "SUP-C", name: "Thuốc C", unitPrice: 3000 });
  await receiveViaApi(pharmacistCookie, stocked.id, 50);
  await receiveViaApi(pharmacistCookie, other.id, 50);
  const { appointment, record } = await createRecord("SUP-RECORD-3", "0955700003", fixture.slotTwo.id);

  const prescription = await PrescriptionService.createForMedicalRecord(
    record.id,
    {
      items: [
        { medicineName: "Thuốc B mua ngoài", quantity: 2, medicineId: stocked.id, buyOutside: true },
        { medicineName: "Thuốc ngoài danh mục", quantity: 1 },
        { medicineName: "Thuốc C", quantity: 1, medicineId: other.id },
      ],
    },
    doctorActor(),
  );
  assert.deepEqual(await itemStatuses(prescription.id), ["OUTSIDE", "OUTSIDE", "PENDING"]);

  // Sửa dòng: bỏ đánh dấu mua ngoài của thuốc kho thì chờ dược sĩ cấp; bỏ gắn thuốc kho thì thành mua ngoài.
  const items = await prisma.prescriptionItem.findMany({ where: { prescriptionId: prescription.id }, orderBy: { sortOrder: "asc" } });
  await PrescriptionService.updateItem(prescription.id, items[0].id, { buyOutside: false }, doctorActor());
  await PrescriptionService.updateItem(prescription.id, items[2].id, { medicineId: null }, doctorActor());
  assert.deepEqual(await itemStatuses(prescription.id), ["PENDING", "OUTSIDE", "OUTSIDE"]);

  // Hóa đơn chỉ tính dòng lấy từ kho.
  await PrescriptionService.issue(prescription.id, doctorActor());
  const invoice = await InvoiceService.createForAppointment(appointment.id, {});
  const medicineLines = invoice.items.filter((line) => line.type === "MEDICINE");
  assert.equal(medicineLines.length, 1);
  assert.equal(medicineLines[0].amount, 4000);

  // Ràng buộc cơ sở dữ liệu: dòng không thuộc kho mà còn chờ cấp là không hợp lệ.
  await assert.rejects(() =>
    prisma.prescriptionItem.create({
      data: { prescriptionId: prescription.id, medicineName: "Dòng lơ lửng", fulfillmentStatus: "PENDING" },
    }),
  );
});

test("a supplementary prescription issued after payment gets its own supplement and is dispensed only once paid", async () => {
  const pharmacist = await createDashboardUser("PHARMACIST", "0900000503");
  const pharmacistCookie = await authCookie(pharmacist.id, "PHARMACIST");
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");
  const medicine = await createMedicineViaApi(pharmacistCookie, { code: "SUP-D", name: "Thuốc D", unitPrice: 1000 });
  await receiveViaApi(pharmacistCookie, medicine.id, 50);
  const stock = async () => (await prisma.medicine.findUniqueOrThrow({ where: { id: medicine.id } })).stockQuantity;
  const { appointment, record } = await createRecord("SUP-RECORD-4", "0955700004", fixture.slotTwo.id);

  const first = await PrescriptionService.createForMedicalRecord(
    record.id,
    { items: [{ medicineName: "Thuốc D", quantity: 2, medicineId: medicine.id }] },
    doctorActor(),
  );
  await PrescriptionService.issue(first.id, doctorActor());
  const invoice = await InvoiceService.createForAppointment(appointment.id, {});
  await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "PAID", paidAt: new Date() } });

  // Cần thêm thuốc sau khi đã thanh toán: bác sĩ tạo đơn bổ sung, đơn đầu không bị sửa.
  const second = await PrescriptionService.createForMedicalRecord(
    record.id,
    { items: [{ medicineName: "Thuốc D", quantity: 3, medicineId: medicine.id }] },
    doctorActor(),
  );
  await PrescriptionService.issue(second.id, doctorActor());

  const supplements = await prisma.invoiceSupplement.findMany({ where: { invoiceId: invoice.id } });
  assert.equal(supplements.length, 1);
  assert.equal(supplements[0].amount, 3000);
  assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).totalAmount, invoice.totalAmount);

  const dispense = (prescriptionId: string) =>
    http.request(`/api/v1/dashboard/pharmacy/prescriptions/${prescriptionId}/dispense`, {
      method: "POST",
      headers: dashboardHeaders(pharmacistCookie),
      body: { confirmed: true },
    });
  // Chưa thu hóa đơn phụ thì không cấp được đơn bổ sung.
  const refused = await dispense(second.id);
  assert.equal(refused.status, 409);
  assert.equal(refused.body.code, "PAYMENT_REQUIRED");
  assert.equal(await stock(), 50);

  await InvoiceMedicineService.paySupplement(invoice.id, supplements[0].id, { paymentMethod: "CASH" }, fixture.adminUser.id);
  const dispensed = await dispense(second.id);
  assert.equal(dispensed.status, 200, JSON.stringify(dispensed.body));
  assert.equal(await stock(), 47);
  assert.equal((await prisma.prescription.findUniqueOrThrow({ where: { id: second.id } })).dispenseStatus, "DISPENSED");
  void adminCookie;
});
