/**
 * Thêm dữ liệu mẫu cho các kịch bản nghiệm thu luồng khám - kê đơn - thanh toán - cấp thuốc - hoàn tiền thuốc.
 * Chạy sau `npm run seed:clinic` (cần bác sĩ, lịch trống và danh mục thuốc có sẵn). Dùng lại các service thật nên
 * hóa đơn, dòng tiền thuốc và hóa đơn bổ sung được tạo đúng như khi thao tác trên dashboard.
 *
 * Bắt buộc: ALLOW_DEMO_SEED=true.
 * Tùy chọn: DEMO_PATIENT_EMAIL (mặc định nguoikham.mau@devkuncare.com, tài khoản người khám dùng đăng nhập OTP trên app)
 * và DEMO_PATIENT_PHONE (số liên hệ, mặc định 0325123456).
 * Chạy lại an toàn: kịch bản nào đã có (đánh dấu trong lý do khám bắt đầu bằng "[DEMO] <mã>") thì bỏ qua.
 */
import { prisma } from "../config/prisma.js";
import InvoiceService from "../services/invoice.service.js";
import MedicalRecordService from "../services/medicalRecord.service.js";
import PrescriptionService from "../services/prescription.service.js";
import { CODE_PREFIX, generateDatedCode } from "../utils/datedCode.js";

type Actor = { userId: string; role: "DOCTOR" | "ADMIN" };
type Line = { code: string; quantity: number; dosage?: string };

type Scenario = {
  key: string;
  title: string;
  status: "CONFIRMED" | "IN_PROGRESS" | "COMPLETED";
  // Đơn thuốc: không có thì bỏ qua; issued=false để lại bản nháp.
  prescription?: { lines: Line[]; issued: boolean; acknowledgeShortage?: boolean };
  invoice?: "UNPAID" | "PAID";
  // Sau khi phát hành và thu tiền: bác sĩ đánh dấu dòng này hết hàng (chỉ mục dòng, từ 0).
  outOfStockLine?: number;
  published?: boolean;
};

const SCENARIOS: Scenario[] = [
  { key: "A", title: "Lịch đã xác nhận, chờ tiếp nhận", status: "CONFIRMED" },
  { key: "B", title: "Đang khám, chưa có đơn (thử hộp xác nhận hồ sơ trống và kê vượt tồn)", status: "IN_PROGRESS" },
  {
    key: "C",
    title: "Đã khám, đơn đã phát hành, chưa lập hóa đơn",
    status: "COMPLETED",
    published: true,
    prescription: { lines: [{ code: "PARA500", quantity: 10 }, { code: "CET10", quantity: 5 }], issued: true },
  },
  {
    key: "D",
    title: "Hóa đơn chưa thanh toán đã gồm tiền thuốc",
    status: "COMPLETED",
    prescription: { lines: [{ code: "AMOX500", quantity: 10 }, { code: "OME20", quantity: 14 }], issued: true },
    invoice: "UNPAID",
  },
  {
    key: "E",
    title: "Đã thanh toán, đơn còn nháp (phát hành sẽ tạo hóa đơn bổ sung; có dòng vượt tồn)",
    status: "COMPLETED",
    prescription: { lines: [{ code: "AMOX500", quantity: 10 }, { code: "AZI250", quantity: 300 }], issued: false },
    invoice: "PAID",
  },
  {
    key: "F",
    title: "Đã thanh toán, đơn chờ cấp (thử cấp thuốc và nút đánh dấu của bác sĩ)",
    status: "COMPLETED",
    prescription: { lines: [{ code: "IBU400", quantity: 10 }, { code: "LORA10", quantity: 6 }], issued: true },
    invoice: "PAID",
  },
  {
    key: "G",
    title: "Đã thanh toán, có dòng hết hàng chờ hoàn tiền thuốc",
    status: "COMPLETED",
    prescription: { lines: [{ code: "OME20", quantity: 14 }, { code: "AMLO5", quantity: 10 }], issued: true },
    invoice: "PAID",
    outOfStockLine: 1,
  },
];

const marker = (key: string) => `[DEMO] ${key}`;

async function main() {
  if (process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Chặn nạp dữ liệu mẫu. Đặt ALLOW_DEMO_SEED=true nếu chắc chắn.");
  }

  const email = (process.env.DEMO_PATIENT_EMAIL?.trim() || "nguoikham.mau@devkuncare.com").toLowerCase();
  const phone = process.env.DEMO_PATIENT_PHONE?.trim() || "0325123456";
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", isActive: true }, orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("Chưa có tài khoản quản trị. Chạy `npm run seed:clinic` trước.");
  const doctor = await prisma.doctorProfile.findFirst({
    where: { department: { isTriageFallback: true }, isAvailable: true },
    include: { user: true, department: true },
    orderBy: { createdAt: "asc" },
  });
  if (!doctor) throw new Error("Chưa có bác sĩ. Chạy `npm run seed:clinic` trước.");
  const doctorActor: Actor = { userId: doctor.userId, role: "DOCTOR" };
  const adminActor: Actor = { userId: admin.id, role: "ADMIN" };

  const patient = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, phone, fullName: "Người khám mẫu", role: "PATIENT", isEmailVerified: true },
  });

  const medicines = await prisma.medicine.findMany({ where: { isActive: true } });
  const medicineByCode = new Map(medicines.map((item) => [item.code, item]));
  const tomorrow = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const created: string[] = [];
  for (const scenario of SCENARIOS) {
    const exists = await prisma.appointment.findFirst({
      where: { patientId: patient.id, reason: { startsWith: marker(scenario.key) } },
      select: { bookingCode: true },
    });
    if (exists) {
      console.log(`[demo] ${scenario.key}: đã có ${exists.bookingCode}, bỏ qua`);
      continue;
    }

    const slot = await prisma.doctorTimeSlot.findFirst({
      where: { doctorId: doctor.id, status: "AVAILABLE", date: { gte: tomorrow } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });
    if (!slot) throw new Error("Hết khung giờ trống của bác sĩ. Chạy lại `npm run seed:clinic`.");

    const now = new Date();
    const appointment = await prisma.$transaction(async (tx) => {
      await tx.doctorTimeSlot.update({ where: { id: slot.id }, data: { status: "BOOKED" } });
      return tx.appointment.create({
        data: {
          bookingCode: generateDatedCode(CODE_PREFIX.booking),
          appointmentDate: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          status: scenario.status,
          reason: `${marker(scenario.key)} ${scenario.title}`,
          patientName: patient.fullName,
          patientPhone: phone,
          patientEmail: email,
          patientInfo: { create: {} },
          patientId: patient.id,
          doctorId: doctor.id,
          departmentId: doctor.departmentId,
          timeSlotId: slot.id,
          estimatedPrice: doctor.consultationFee,
          finalAmount: doctor.consultationFee,
          confirmedAt: now,
          completedAt: scenario.status === "COMPLETED" ? now : null,
        },
      });
    });

    if (scenario.status !== "CONFIRMED") {
      const record = await MedicalRecordService.ensureForAppointment(appointment.id);
      if (scenario.published) {
        await prisma.medicalRecord.update({
          where: { id: record.id },
          data: {
            symptoms: "Ho, sổ mũi 3 ngày",
            diagnosis: "Viêm mũi họng cấp",
            treatment: "Nghỉ ngơi, uống đủ nước, dùng thuốc theo đơn",
            status: "PUBLISHED",
            publishedAt: now,
          },
        });
      }
      const recordRow = await prisma.medicalRecord.findUniqueOrThrow({ where: { id: record.id }, select: { recordCode: true } });

      let prescriptionId: string | null = null;
      if (scenario.prescription) {
        const prescription = await PrescriptionService.createForMedicalRecord(recordRow.recordCode, { note: "Đơn mẫu" }, doctorActor);
        prescriptionId = prescription.id;
        for (const line of scenario.prescription.lines) {
          const medicine = medicineByCode.get(line.code);
          if (!medicine) throw new Error(`Không có thuốc ${line.code} trong danh mục. Chạy \`npm run seed:clinic\` trước.`);
          await PrescriptionService.createItem(
            prescription.id,
            {
              medicineId: medicine.id,
              medicineName: `${medicine.name} ${medicine.strength ?? ""}`.trim(),
              dosage: line.dosage ?? "1 viên",
              frequency: "2 lần/ngày",
              duration: "5 ngày",
              quantity: line.quantity,
              unit: medicine.unit,
            },
            doctorActor,
          );
        }
        if (scenario.prescription.issued) {
          await PrescriptionService.issue(prescription.id, doctorActor, { acknowledgeShortage: true });
        }
      }

      if (scenario.invoice) {
        const invoice = await InvoiceService.createForAppointment(appointment.id, {});
        if (scenario.invoice === "PAID") await InvoiceService.pay(invoice.id, { paymentMethod: "CASH" }, adminActor.userId);
      }

      if (scenario.outOfStockLine !== undefined && prescriptionId) {
        const items = await prisma.prescriptionItem.findMany({ where: { prescriptionId }, orderBy: { sortOrder: "asc" } });
        await PrescriptionService.resolveItem(prescriptionId, items[scenario.outOfStockLine].id, { status: "OUT_OF_STOCK" }, doctorActor);
      }
    }

    const row = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id }, select: { bookingCode: true } });
    created.push(`${scenario.key}: ${row.bookingCode} — ${scenario.title}`);
  }

  console.log(`\n[demo] Người khám mẫu: ${email} (đăng nhập OTP trên app)`);
  console.log(`[demo] Bác sĩ: ${doctor.user.fullName} — ${doctor.department.name}`);
  for (const line of created) console.log(`[demo] ${line}`);
}

main()
  .catch((error) => {
    console.error("[demo] Lỗi:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
