import { RbacService, assert, authCookie, createDashboardUser, createIssuedPrescription, createStoredAppointment, dashboardCall, fixture, prisma, test } from "./support/context.js";

// Hợp đồng "ai thấy dữ liệu nhúng nào" (xem services/dataVisibility.ts). Quyền kiểm ở cửa vào API không đủ: hồ sơ khám nhúng đơn thuốc,
// đơn thuốc nhúng chẩn đoán, lịch hẹn nhúng hóa đơn. Thiếu quyền của miền được nhúng thì chỉ thấy phần tối thiểu.

test("a medical record shows its prescriptions only to viewers who may see prescriptions", async () => {
  const issued = await createIssuedPrescription({
    code: "VIS-RX-1",
    phone: "0955800001",
    timeSlotId: fixture.slotTwo.id,
    items: [{ medicineName: "Thuốc kiểm thử", quantity: 2 }],
  });
  const adminCookie = await authCookie(fixture.adminUser.id, "ADMIN");
  const doctorCookie = await authCookie(fixture.doctorOneUser.id, "DOCTOR");
  const recordId = issued.prescription.medicalRecordId;
  const detail = (cookie: string) => dashboardCall("GET", `/api/v1/dashboard/medical-records/${recordId}`, cookie);
  const list = (cookie: string) => dashboardCall("GET", "/api/v1/dashboard/medical-records", cookie);

  try {
    // Quản trị được cấp xem bệnh án nhưng KHÔNG được cấp xem đơn thuốc (đúng cấu hình production).
    const granted = await dashboardCall("PUT", "/api/v1/dashboard/rbac", adminCookie, { grants: { "record.view": ["ADMIN", "DOCTOR"] } });
    assert.equal(granted.status, 200, JSON.stringify(granted.body));

    const asAdmin = await detail(adminCookie);
    assert.equal(asAdmin.status, 200);
    assert.deepEqual(asAdmin.body.data.prescriptions, []);
    assert.equal(asAdmin.body.data.prescriptionAccess, false);
    const adminList = await list(adminCookie);
    assert.equal(adminList.status, 200);
    assert.ok(adminList.body.data.items.every((item: { prescriptions: unknown[]; prescriptionAccess: boolean }) => item.prescriptions.length === 0 && item.prescriptionAccess === false));
    // Ngay cả khi đoán được id đơn thuốc, đường riêng của đơn thuốc vẫn chặn.
    assert.equal((await dashboardCall("GET", `/api/v1/dashboard/prescriptions/${issued.prescription.id}`, adminCookie)).status, 403);

    // Bác sĩ có cả hai quyền: thấy đủ.
    const asDoctor = await detail(doctorCookie);
    assert.equal(asDoctor.status, 200);
    assert.equal(asDoctor.body.data.prescriptionAccess, true);
    assert.equal(asDoctor.body.data.prescriptions.length, 1);
    assert.equal(asDoctor.body.data.prescriptions[0].items.length, 1);

    // Cấp thêm quyền xem đơn thuốc cho quản trị thì thấy (quyền có hiệu lực ngay).
    const grantedRx = await dashboardCall("PUT", "/api/v1/dashboard/rbac", adminCookie, { grants: { "prescription.view": ["ADMIN", "DOCTOR", "PHARMACIST"] } });
    assert.equal(grantedRx.status, 200, JSON.stringify(grantedRx.body));
    const afterGrant = await detail(adminCookie);
    assert.equal(afterGrant.body.data.prescriptionAccess, true);
    assert.equal(afterGrant.body.data.prescriptions.length, 1);
  } finally {
    await RbacService.resetMatrix();
  }
});

test("a prescription hides the diagnosis and treatment from viewers who may not read medical records", async () => {
  const issued = await createIssuedPrescription({
    code: "VIS-RX-2",
    phone: "0955800002",
    timeSlotId: fixture.slotTwo.id,
    items: [{ medicineName: "Thuốc kiểm thử", quantity: 1 }],
  });
  await prisma.medicalRecord.update({
    where: { id: issued.prescription.medicalRecordId! },
    data: { diagnosis: "Chẩn đoán bí mật", treatment: "Hướng điều trị bí mật" },
  });
  const pharmacist = await createDashboardUser("PHARMACIST", "0900000701");
  const pharmacistCookie = await authCookie(pharmacist.id, "PHARMACIST");
  const doctorCookie = await authCookie(fixture.doctorOneUser.id, "DOCTOR");
  const path = `/api/v1/dashboard/prescriptions/${issued.prescription.id}`;

  const asPharmacist = await dashboardCall("GET", path, pharmacistCookie);
  assert.equal(asPharmacist.status, 200);
  assert.equal(asPharmacist.body.data.items.length, 1, "pharmacist still sees the prescription itself");
  assert.equal(asPharmacist.body.data.medicalRecord.diagnosis, null);
  assert.equal(asPharmacist.body.data.medicalRecord.treatment, null);
  assert.ok(!JSON.stringify(asPharmacist.body).includes("bí mật"));

  const list = await dashboardCall("GET", "/api/v1/dashboard/prescriptions", pharmacistCookie);
  assert.equal(list.status, 200);
  assert.ok(!JSON.stringify(list.body).includes("bí mật"));

  const asDoctor = await dashboardCall("GET", path, doctorCookie);
  assert.equal(asDoctor.body.data.medicalRecord.diagnosis, "Chẩn đoán bí mật");
  assert.equal(asDoctor.body.data.medicalRecord.treatment, "Hướng điều trị bí mật");
});

test("an appointment shows its invoice details only to viewers who may see invoices, including action responses", async () => {
  const appointment = await createStoredAppointment({ status: "CHECKED_IN", bookingCode: "VIS-BILL-1", phone: "0955800003" });
  await prisma.appointmentPatientInfo.update({
    where: { appointmentId: appointment.id },
    data: { allergies: "Dị ứng penicillin", medicalHistory: "Tiền sử hen" },
  });
  const invoice = await prisma.invoice.create({
    data: {
      invoiceCode: "INV-VIS-BILL-1",
      barcode: "BAR-VIS-BILL-1",
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      totalAmount: 300000,
      finalAmount: 300000,
      paymentReference: "REF-SECRET-1",
    },
  });
  const staff = await createDashboardUser("STAFF", "0900000702");
  const staffCookie = await authCookie(staff.id, "STAFF");
  const doctorCookie = await authCookie(fixture.doctorOneUser.id, "DOCTOR");
  const path = `/api/v1/dashboard/appointments/${appointment.id}`;

  // Nhân viên có invoice.view: thấy đủ hóa đơn, nhưng KHÔNG thấy dị ứng/tiền sử (không có record.view).
  const asStaff = await dashboardCall("GET", path, staffCookie);
  assert.equal(asStaff.status, 200);
  assert.equal(asStaff.body.data.invoice.totalAmount, 300000);
  assert.equal(asStaff.body.data.invoice.paymentReference, "REF-SECRET-1");
  assert.equal(asStaff.body.data.allergies, null);
  assert.equal(asStaff.body.data.medicalHistory, null);

  // Bác sĩ có record.view nhưng không có invoice.view: thấy dị ứng, chỉ biết đã có hóa đơn.
  const asDoctor = await dashboardCall("GET", path, doctorCookie);
  assert.equal(asDoctor.status, 200);
  assert.equal(asDoctor.body.data.allergies, "Dị ứng penicillin");
  assert.deepEqual(Object.keys(asDoctor.body.data.invoice).sort(), ["id", "invoiceCode", "status"]);
  assert.equal(asDoctor.body.data.invoice.id, invoice.id);
  assert.ok(!JSON.stringify(asDoctor.body).includes("REF-SECRET-1"));

  const doctorList = await dashboardCall("GET", "/api/v1/dashboard/appointments?q=VIS-BILL-1", doctorCookie);
  assert.equal(doctorList.status, 200);
  assert.ok(!JSON.stringify(doctorList.body).includes("REF-SECRET-1"));
  assert.ok(!JSON.stringify(doctorList.body).includes("paymentUrl"));

  // Kết quả của thao tác cũng qua cùng bộ che: bác sĩ bắt đầu buổi khám thì phản hồi không kèm chi tiết hóa đơn.
  const started = await dashboardCall("PATCH", `${path}/start`, doctorCookie);
  assert.equal(started.status, 200, JSON.stringify(started.body));
  assert.ok(!JSON.stringify(started.body).includes("REF-SECRET-1"));
  assert.equal(started.body.data.allergies, "Dị ứng penicillin");
});
