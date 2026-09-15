import { prisma } from "../config/prisma.js";
import { hashPassword } from "../utils/password.js";
import { buildTimeSlots } from "../utils/time.js";

const PASSWORD = "@DevKun2212";
const SLOT_DAYS = 14;

const resetRequested = process.env.RESET_DATABASE === "true";
const resetAllowed = process.env.ALLOW_DATABASE_RESET === "true";

const toSlug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const toDateOnly = (date: Date) => date.toISOString().slice(0, 10);
const parseDateOnly = (date: string) => new Date(`${date}T00:00:00.000Z`);

const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
};

const getToday = () => parseDateOnly(toDateOnly(new Date()));

async function resetDatabase() {
  if (!resetRequested) return;

  if (!resetAllowed) {
    throw new Error("Reset database bi chan. Hay set RESET_DATABASE=true va ALLOW_DATABASE_RESET=true neu chac chan.");
  }

  await prisma.$transaction([
    prisma.paymentTransaction.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.prescriptionItem.deleteMany(),
    prisma.prescription.deleteMany(),
    prisma.labResult.deleteMany(),
    prisma.medicalRecord.deleteMany(),
    prisma.review.deleteMany(),
    prisma.appointmentLog.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.doctorTimeSlot.deleteMany(),
    prisma.scheduleChangeLog.deleteMany(),
    prisma.doctorSchedule.deleteMany(),
    prisma.packageItem.deleteMany(),
    prisma.package.deleteMany(),
    prisma.doctorProfile.deleteMany(),
    prisma.patientProfile.deleteMany(),
    prisma.dashboardLoginChallenge.deleteMany(),
    prisma.otpCode.deleteMany(),
    prisma.otpVerifyAttempt.deleteMany(),
    prisma.otpSecurityBlock.deleteMany(),
    prisma.mediaAsset.deleteMany(),
    prisma.chatbotLog.deleteMany(),
    prisma.chatbotSession.deleteMany(),
    prisma.chatbotFAQ.deleteMany(),
    prisma.chatbotSetting.deleteMany(),
    prisma.publicFAQ.deleteMany(),
    prisma.banner.deleteMany(),
    prisma.siteSetting.deleteMany(),
    prisma.consultationRequest.deleteMany(),
    prisma.user.deleteMany(),
    prisma.department.deleteMany(),
  ]);
}

async function upsertUser(data: {
  fullName: string;
  phone: string;
  email: string;
  role: "ADMIN" | "STAFF" | "DOCTOR" | "PATIENT";
  password?: string;
  avatar?: string;
}) {
  const hashedPassword = data.password ? await hashPassword(data.password) : null;

  return prisma.user.upsert({
    where: { phone: data.phone },
    update: {
      fullName: data.fullName,
      email: data.email,
      role: data.role,
      password: hashedPassword,
      avatar: data.avatar,
      isActive: true,
      isPhoneVerified: true,
      isEmailVerified: true,
    },
    create: {
      fullName: data.fullName,
      phone: data.phone,
      email: data.email,
      role: data.role,
      password: hashedPassword,
      avatar: data.avatar,
      isActive: true,
      isPhoneVerified: true,
      isEmailVerified: true,
    },
  });
}

async function upsertDepartment(data: {
  name: string;
  description: string;
  image: string;
  symptomKeywords: string[];
  triageDescription: string;
  isTriageFallback?: boolean;
}) {
  return prisma.department.upsert({
    where: { name: data.name },
    update: {
      slug: toSlug(data.name),
      description: data.description,
      image: data.image,
      symptomKeywords: data.symptomKeywords,
      triageDescription: data.triageDescription,
      isTriageFallback: data.isTriageFallback ?? false,
      isActive: true,
    },
    create: {
      name: data.name,
      slug: toSlug(data.name),
      description: data.description,
      image: data.image,
      symptomKeywords: data.symptomKeywords,
      triageDescription: data.triageDescription,
      isTriageFallback: data.isTriageFallback ?? false,
      isActive: true,
    },
  });
}

async function upsertDoctor(data: {
  userId: string;
  departmentId: string;
  title: string;
  specialization: string;
  bio: string;
  experience: number;
  consultationFee: number;
}) {
  return prisma.doctorProfile.upsert({
    where: { userId: data.userId },
    update: { ...data, isAvailable: true },
    create: { ...data, isAvailable: true },
  });
}

async function upsertPackage(data: {
  name: string;
  description: string;
  summary: string;
  note?: string;
  departmentId: string;
  serviceFee: number;
  isPopular?: boolean;
  isBHYTSupport?: boolean;
  items: { name: string; description: string; price: number; included?: boolean; order: number }[];
}) {
  const includedTotal = data.items.filter((item) => item.included !== false).reduce((total, item) => total + item.price, 0);
  const slug = toSlug(data.name);

  const packageItem = await prisma.package.upsert({
    where: { slug },
    update: {
      name: data.name,
      description: data.description,
      summary: data.summary,
      note: data.note,
      departmentId: data.departmentId,
      basePrice: includedTotal,
      serviceFee: data.serviceFee,
      isPopular: data.isPopular ?? false,
      isBHYTSupport: data.isBHYTSupport ?? false,
      isActive: true,
    },
    create: {
      name: data.name,
      slug,
      description: data.description,
      summary: data.summary,
      note: data.note,
      departmentId: data.departmentId,
      basePrice: includedTotal,
      serviceFee: data.serviceFee,
      isPopular: data.isPopular ?? false,
      isBHYTSupport: data.isBHYTSupport ?? false,
      isActive: true,
    },
  });

  await prisma.packageItem.deleteMany({ where: { packageId: packageItem.id } });
  await prisma.packageItem.createMany({
    data: data.items.map((item) => ({
      packageId: packageItem.id,
      name: item.name,
      description: item.description,
      price: item.price,
      included: item.included ?? true,
      order: item.order,
    })),
  });

  return prisma.package.findUniqueOrThrow({
    where: { id: packageItem.id },
    include: { items: true, department: true },
  });
}

async function upsertSchedules(doctorId: string) {
  for (const dayOfWeek of [1, 2, 3, 4, 5, 6]) {
    for (const range of [
      { startTime: "08:00", endTime: "11:30" },
      { startTime: "13:30", endTime: "16:30" },
    ]) {
      const existing = await prisma.doctorSchedule.findFirst({
        where: { doctorId, dayOfWeek, startTime: range.startTime, endTime: range.endTime },
      });

      if (existing) {
        await prisma.doctorSchedule.update({
          where: { id: existing.id },
          data: { slotDuration: 30, maxPatients: 1, isActive: true },
        });
      } else {
        await prisma.doctorSchedule.create({
          data: { doctorId, dayOfWeek, ...range, slotDuration: 30, maxPatients: 1, isActive: true },
        });
      }
    }
  }
}

async function generateSlots(doctorId: string) {
  const today = getToday();
  let count = 0;

  for (let offset = 0; offset < SLOT_DAYS; offset += 1) {
    const date = addDays(today, offset);
    const schedules = await prisma.doctorSchedule.findMany({
      where: { doctorId, dayOfWeek: date.getUTCDay(), isActive: true },
    });
    const slots = schedules.flatMap((schedule) =>
      buildTimeSlots(schedule.startTime, schedule.endTime, schedule.slotDuration).map((slot) => ({
        doctorId,
        date,
        startTime: slot.startTime,
        endTime: slot.endTime,
      })),
    );

    if (slots.length) {
      await prisma.doctorTimeSlot.createMany({ data: slots, skipDuplicates: true });
      count += slots.length;
    }
  }

  return count;
}

async function upsertSiteContent() {
  await prisma.siteSetting.upsert({
    where: { key: "site_settings" },
    update: {
      value: {
        hospitalName: "Hospital Booking Dev",
        logo: "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=240&q=80",
        favicon: "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=64&q=80",
        hotline: "1900 1234",
        emergencyHotline: "115",
        email: "contact@hospital-booking.test",
        address: "475A Điện Biên Phủ, Bình Thạnh, TP. Hồ Chí Minh",
        workingHours: "Thứ 2 - Thứ 7, 08:00 - 16:30",
        mapUrl: "https://maps.google.com",
        socialLinks: {
          facebook: "https://facebook.com",
          zalo: "https://zalo.me",
          youtube: "https://youtube.com",
        },
      },
      isActive: true,
    },
    create: {
      key: "site_settings",
      value: {
        hospitalName: "Hospital Booking Dev",
        logo: "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=240&q=80",
        favicon: "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=64&q=80",
        hotline: "1900 1234",
        emergencyHotline: "115",
        email: "contact@hospital-booking.test",
        address: "475A Điện Biên Phủ, Bình Thạnh, TP. Hồ Chí Minh",
        workingHours: "Thứ 2 - Thứ 7, 08:00 - 16:30",
        mapUrl: "https://maps.google.com",
        socialLinks: {
          facebook: "https://facebook.com",
          zalo: "https://zalo.me",
          youtube: "https://youtube.com",
        },
      },
      description: "Cấu hình website demo",
      isActive: true,
    },
  });

  await prisma.banner.deleteMany({});
  await prisma.banner.createMany({
    data: [
      {
        title: "Đặt lịch khám chủ động",
        subtitle: "Chọn chuyên khoa, bác sĩ và khung giờ phù hợp chỉ trong vài bước.",
        image: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1600&q=80",
        position: "HOME_HERO",
        order: 1,
        isActive: true,
      },
      {
        title: "Gói khám tổng quát",
        subtitle: "Tầm soát sức khỏe định kỳ với chi phí minh bạch.",
        image: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1600&q=80",
        position: "HOME_HERO",
        order: 2,
        isActive: true,
      },
      {
        title: "Ưu tiên tư vấn trước khi đến viện",
        subtitle: "Để lại số điện thoại, nhân viên sẽ hỗ trợ lựa chọn lịch khám.",
        image: "https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=1600&q=80",
        position: "HOME_PROMO",
        order: 1,
        isActive: true,
      },
    ],
  });

  await prisma.publicFAQ.deleteMany({});
  await prisma.publicFAQ.createMany({
    data: [
      { question: "Tôi đặt lịch khám như thế nào?", answer: "Bạn chọn chuyên khoa, bác sĩ, ngày khám, khung giờ trống và xác thực OTP để hoàn tất đặt lịch.", category: "booking", order: 1 },
      { question: "Tôi quên mã lịch thì phải làm sao?", answer: "Bạn vào Tra cứu lịch hẹn, chọn quên mã lịch, nhập số điện thoại đã đặt lịch và xác thực OTP để xem lịch gần đây.", category: "booking", order: 2 },
      { question: "Có hỗ trợ BHYT không?", answer: "Một số gói khám có hỗ trợ BHYT tùy tuyến khám, thông tin thẻ và chính sách hiện hành.", category: "insurance", order: 3 },
      { question: "Thanh toán hóa đơn ở đâu?", answer: "Bạn có thể thanh toán tại quầy hoặc dùng cổng thanh toán online nếu bệnh viện đã cấu hình nhà cung cấp.", category: "payment", order: 4 },
      { question: "Tôi có thể chọn bác sĩ không?", answer: "Có. Bạn có thể chọn bác sĩ còn lịch trống trong chuyên khoa phù hợp.", category: "doctor", order: 5 },
      { question: "Cần chuẩn bị gì trước khi đi khám?", answer: "Bạn nên mang giấy tờ tùy thân, thẻ BHYT nếu có, đơn thuốc và kết quả xét nghiệm cũ.", category: "general", order: 6 },
    ],
  });
}

async function upsertChatbotContent() {
  await prisma.chatbotSetting.upsert({
    where: { key: "runtime" },
    update: {
      value: {
        aiEnabled: false,
        fallbackEnabled: true,
        faqEnabled: true,
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        maxSuggestedActions: 4,
        sessionExpiresDays: 7,
      },
      isActive: true,
    },
    create: {
      key: "runtime",
      value: {
        aiEnabled: false,
        fallbackEnabled: true,
        faqEnabled: true,
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        maxSuggestedActions: 4,
        sessionExpiresDays: 7,
      },
      description: "Cấu hình chatbot demo an toàn",
      isActive: true,
    },
  });

  await prisma.chatbotFAQ.deleteMany({});
  await prisma.chatbotFAQ.createMany({
    data: [
      {
        question: "Cách đặt lịch khám",
        answer: "Bạn có thể chọn chuyên khoa, gói khám, bác sĩ và khung giờ còn trống, sau đó xác thực OTP để hoàn tất đặt lịch.",
        keywords: ["dat lich", "đặt lịch", "huong dan", "hướng dẫn"],
        isActive: true,
      },
      {
        question: "Quên mã lịch",
        answer: "Nếu quên mã lịch, hãy dùng mục Tra cứu lịch hẹn và xác thực OTP bằng số điện thoại đã đặt lịch.",
        keywords: ["quen ma", "quên mã", "tra cuu", "tra cứu"],
        isActive: true,
      },
      {
        question: "Bảo hiểm y tế",
        answer: "BHYT được xem xét theo thông tin thẻ, tuyến khám và phần chi phí đủ điều kiện.",
        keywords: ["bhyt", "bao hiem", "bảo hiểm"],
        isActive: true,
      },
    ],
  });
}

async function seedAppointments(doctors: Awaited<ReturnType<typeof upsertDoctor>>[], packages: Awaited<ReturnType<typeof upsertPackage>>[]) {
  const patients = await Promise.all([
    upsertUser({ fullName: "Nguyễn Minh Anh", phone: "0391234567", email: "minhanh@example.com", role: "PATIENT" }),
    upsertUser({ fullName: "Trần Hoàng Nam", phone: "0321258369", email: "hoangnam@example.com", role: "PATIENT" }),
    upsertUser({ fullName: "Lê Thị Bích", phone: "0387654321", email: "lebich@example.com", role: "PATIENT" }),
    upsertUser({ fullName: "Phạm Quốc Huy", phone: "0369988776", email: "quochuy@example.com", role: "PATIENT" }),
  ]);

  const statuses = ["PENDING_CONFIRM", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "COMPLETED", "CANCELLED_BY_PATIENT", "NO_SHOW"] as const;
  const created = [];

  for (let index = 0; index < statuses.length; index += 1) {
    const doctor = doctors[index % doctors.length];
    const packageItem = packages[index % packages.length];
    const patient = patients[index % patients.length];
    const slot = await prisma.doctorTimeSlot.findFirst({
      where: {
        doctorId: doctor.id,
        status: "AVAILABLE",
        date: { gte: getToday() },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    if (!slot) continue;

    const status = statuses[index];
    const bookingCode = `BKDEMO${String(index + 1).padStart(4, "0")}`;
    const hasBHYT = index % 2 === 0;
    const serviceFee = packageItem.serviceFee;
    const estimatedPrice = packageItem.basePrice;
    const bhytDiscount = hasBHYT && packageItem.isBHYTSupport ? 50000 : 0;
    const finalAmount = Math.max(0, estimatedPrice + serviceFee - bhytDiscount);

    const appointment = await prisma.appointment.upsert({
      where: { bookingCode },
      update: {
        status,
        appointmentDate: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        estimatedPrice,
        serviceFee,
        bhytDiscount,
        finalAmount,
      },
      create: {
        bookingCode,
        appointmentDate: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status,
        reason: index % 2 === 0 ? "Khám định kỳ và tư vấn sức khỏe." : "Đau đầu, mệt mỏi cần kiểm tra.",
        patientName: patient.fullName,
        patientPhone: patient.phone || "",
        patientEmail: patient.email,
        patientGender: index % 2 === 0 ? "FEMALE" : "MALE",
        patientDateOfBirth: parseDateOnly(`199${index}-0${(index % 8) + 1}-15`),
        hasBHYT,
        healthInsuranceCode: hasBHYT ? `DN40101234${index}` : null,
        registeredHospital: hasBHYT ? "Bệnh viện Quận Bình Thạnh" : null,
        allergies: index % 3 === 0 ? "Dị ứng hải sản" : null,
        medicalHistory: index % 2 === 0 ? "Không ghi nhận bệnh nền." : "Tiền sử viêm dạ dày.",
        familyHistory: "Chưa ghi nhận.",
        estimatedPrice,
        serviceFee,
        bhytDiscount,
        finalAmount,
        patientId: patient.id,
        doctorId: doctor.id,
        departmentId: doctor.departmentId,
        packageId: packageItem.id,
        timeSlotId: slot.id,
        confirmedAt: ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"].includes(status) ? new Date() : null,
        completedAt: status === "COMPLETED" ? new Date() : null,
      },
    });

    await prisma.doctorTimeSlot.update({
      where: { id: slot.id },
      data: { status: status === "CANCELLED_BY_PATIENT" || status === "NO_SHOW" ? "AVAILABLE" : "BOOKED" },
    });

    created.push(appointment);
  }

  return created;
}

async function seedClinicalFlow() {
  const completedAppointments = await prisma.appointment.findMany({
    where: { status: "COMPLETED" },
    take: 4,
    include: { doctor: true, patient: true },
    orderBy: { createdAt: "asc" },
  });

  for (let index = 0; index < completedAppointments.length; index += 1) {
    const appointment = completedAppointments[index];
    const recordCode = `MRDEMO${String(index + 1).padStart(4, "0")}`;
    const prescriptionCode = `RXDEMO${String(index + 1).padStart(4, "0")}`;
    const invoiceCode = `IVDEMO${String(index + 1).padStart(4, "0")}`;

    const record = await prisma.medicalRecord.upsert({
      where: { appointmentId: appointment.id },
      update: {
        symptoms: "Mệt mỏi, cần kiểm tra sức khỏe tổng quát.",
        diagnosis: index % 2 === 0 ? "Theo dõi rối loạn chuyển hóa nhẹ." : "Viêm đường hô hấp trên.",
        treatment: "Tư vấn điều chỉnh sinh hoạt, tái khám nếu triệu chứng kéo dài.",
        doctorNotes: "Dữ liệu demo phục vụ kiểm thử quy trình khám.",
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
      create: {
        recordCode,
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        symptoms: "Mệt mỏi, cần kiểm tra sức khỏe tổng quát.",
        diagnosis: index % 2 === 0 ? "Theo dõi rối loạn chuyển hóa nhẹ." : "Viêm đường hô hấp trên.",
        treatment: "Tư vấn điều chỉnh sinh hoạt, tái khám nếu triệu chứng kéo dài.",
        doctorNotes: "Dữ liệu demo phục vụ kiểm thử quy trình khám.",
        status: "PUBLISHED",
        publishedAt: new Date(),
      },
    });

    await prisma.labResult.deleteMany({ where: { medicalRecordId: record.id } });
    await prisma.labResult.createMany({
      data: [
        { medicalRecordId: record.id, testName: "Công thức máu", resultValue: "Bình thường", conclusion: "Chưa ghi nhận bất thường." },
        { medicalRecordId: record.id, testName: "Đường huyết", resultValue: index % 2 === 0 ? "5.8" : "5.2", unit: "mmol/L", referenceRange: "3.9 - 6.4" },
      ],
    });

    const prescription = await prisma.prescription.upsert({
      where: { medicalRecordId: record.id },
      update: { status: "ISSUED", note: "Uống thuốc theo hướng dẫn, tái khám khi cần.", issuedAt: new Date() },
      create: {
        prescriptionCode,
        medicalRecordId: record.id,
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        status: "ISSUED",
        note: "Uống thuốc theo hướng dẫn, tái khám khi cần.",
        issuedAt: new Date(),
      },
    });

    await prisma.prescriptionItem.deleteMany({ where: { prescriptionId: prescription.id } });
    await prisma.prescriptionItem.createMany({
      data: [
        { prescriptionId: prescription.id, medicineName: "Paracetamol 500mg", dosage: "1 viên", frequency: "Khi sốt hoặc đau", duration: "3 ngày", quantity: 10, unit: "viên", instruction: "Không dùng quá 4g/ngày.", sortOrder: 1 },
        { prescriptionId: prescription.id, medicineName: "Vitamin C", dosage: "1 viên", frequency: "Sau ăn sáng", duration: "7 ngày", quantity: 7, unit: "viên", instruction: "Uống nhiều nước.", sortOrder: 2 },
      ],
    });

    await prisma.invoice.upsert({
      where: { appointmentId: appointment.id },
      update: {
        totalAmount: appointment.estimatedPrice + appointment.serviceFee,
        bhytDiscount: appointment.bhytDiscount,
        finalAmount: appointment.finalAmount,
        insuranceEligibleAmount: appointment.hasBHYT ? appointment.estimatedPrice : 0,
        insuranceCoverageRate: appointment.hasBHYT ? 80 : 0,
        insuranceDiscountAmount: appointment.bhytDiscount,
        insuranceRouteType: appointment.hasBHYT ? "RIGHT_ROUTE" : null,
        status: index === 0 ? "PAID" : index === 1 ? "UNPAID" : "REFUNDED",
        paymentMethod: index === 1 ? null : "CASH",
        paidAt: index === 1 ? null : new Date(),
        refundReason: index > 1 ? "Hoàn tiền demo theo yêu cầu kiểm thử." : null,
        refundedAt: index > 1 ? new Date() : null,
      },
      create: {
        invoiceCode,
        barcode: `BAR${invoiceCode}`,
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        totalAmount: appointment.estimatedPrice + appointment.serviceFee,
        bhytDiscount: appointment.bhytDiscount,
        finalAmount: appointment.finalAmount,
        insuranceEligibleAmount: appointment.hasBHYT ? appointment.estimatedPrice : 0,
        insuranceCoverageRate: appointment.hasBHYT ? 80 : 0,
        insuranceDiscountAmount: appointment.bhytDiscount,
        insuranceRouteType: appointment.hasBHYT ? "RIGHT_ROUTE" : null,
        insuranceNote: appointment.hasBHYT ? "Demo đúng tuyến, áp dụng mức hưởng tham khảo." : null,
        status: index === 0 ? "PAID" : index === 1 ? "UNPAID" : "REFUNDED",
        paymentMethod: index === 1 ? null : "CASH",
        paidAt: index === 1 ? null : new Date(),
        refundReason: index > 1 ? "Hoàn tiền demo theo yêu cầu kiểm thử." : null,
        refundedAt: index > 1 ? new Date() : null,
      },
    });
  }
}

async function seedDemoData() {
  await resetDatabase();

  const [admin, staff, ...doctorUsers] = await Promise.all([
    upsertUser({ fullName: "Admin DevKun", phone: "0352412318", email: "devkun22@gmail.com", role: "ADMIN", password: PASSWORD }),
    upsertUser({ fullName: "Staff Demo", phone: "0352147201", email: "staff.demo@hospital.test", role: "STAFF", password: PASSWORD }),
    upsertUser({ fullName: "ThS.BS Nguyễn Văn Bắc Sĩ", phone: "0352147202", email: "doctor.cardio@hospital.test", role: "DOCTOR", password: PASSWORD }),
    upsertUser({ fullName: "BS.CK1 Trần Thị Bác Sĩ", phone: "0352147203", email: "doctor.general@hospital.test", role: "DOCTOR", password: PASSWORD }),
    upsertUser({ fullName: "BS.CK1 Lê Minh Khoa", phone: "0352412319", email: "doctor.khoa@hospital.test", role: "DOCTOR", password: PASSWORD }),
    upsertUser({ fullName: "ThS.BS Phạm An Nhiên", phone: "0352147205", email: "doctor.obgyn@hospital.test", role: "DOCTOR", password: PASSWORD }),
    upsertUser({ fullName: "BS.CK2 Đỗ Quang Huy", phone: "0352147206", email: "doctor.derma@hospital.test", role: "DOCTOR", password: PASSWORD }),
    upsertUser({ fullName: "ThS.BS Võ Thanh Tâm", phone: "0352147207", email: "doctor.ent@hospital.test", role: "DOCTOR", password: PASSWORD }),
  ]);

  const departments = await Promise.all([
    upsertDepartment({
      name: "Khoa tổng quát",
      description: "Khám ban đầu, tư vấn sức khỏe và tầm soát các vấn đề thường gặp.",
      image: "https://images.unsplash.com/photo-1538108149393-fbbd81895907?auto=format&fit=crop&w=1200&q=80",
      symptomKeywords: ["mệt mỏi", "sốt", "đau đầu", "chóng mặt", "khó chịu toàn thân"],
      triageDescription: "Phù hợp tiếp nhận và đánh giá ban đầu khi triệu chứng chưa định hướng rõ chuyên khoa.",
      isTriageFallback: true,
    }),
    upsertDepartment({
      name: "Khoa tim mạch",
      description: "Khám và theo dõi tăng huyết áp, rối loạn nhịp tim, bệnh mạch vành.",
      image: "https://images.unsplash.com/photo-1628348070889-cb656235b4eb?auto=format&fit=crop&w=1200&q=80",
      symptomKeywords: ["đau ngực", "hồi hộp", "tim đập nhanh", "tăng huyết áp", "khó thở khi gắng sức"],
      triageDescription: "Tiếp nhận các triệu chứng liên quan tim mạch và huyết áp.",
    }),
    upsertDepartment({
      name: "Khoa nhi",
      description: "Khám bệnh trẻ em, tư vấn dinh dưỡng, tiêm chủng và theo dõi phát triển.",
      image: "https://images.unsplash.com/photo-1581056771107-24ca5f033842?auto=format&fit=crop&w=1200&q=80",
      symptomKeywords: ["trẻ sốt", "trẻ ho", "trẻ biếng ăn", "chậm tăng cân", "phát ban ở trẻ"],
      triageDescription: "Tiếp nhận và theo dõi các vấn đề sức khỏe ở trẻ em.",
    }),
    upsertDepartment({
      name: "Khoa sản",
      description: "Theo dõi thai kỳ, khám phụ khoa và tư vấn sức khỏe sinh sản.",
      image: "https://images.unsplash.com/photo-1550831107-1553da8c8464?auto=format&fit=crop&w=1200&q=80",
      symptomKeywords: ["đau bụng thai kỳ", "trễ kinh", "khí hư", "đau bụng dưới", "khám thai"],
      triageDescription: "Tiếp nhận các vấn đề thai kỳ, phụ khoa và sức khỏe sinh sản.",
    }),
    upsertDepartment({
      name: "Da liễu",
      description: "Khám và điều trị mụn, viêm da, dị ứng, chăm sóc da y khoa.",
      image: "https://images.unsplash.com/photo-1612277795421-9bc7706a4a34?auto=format&fit=crop&w=1200&q=80",
      symptomKeywords: ["ngứa da", "nổi mẩn", "phát ban", "mụn", "viêm da", "dị ứng da", "ngứa vùng cổ"],
      triageDescription: "Tiếp nhận các vấn đề về da, tóc, móng, ngứa và phát ban.",
    }),
    upsertDepartment({
      name: "Tai mũi họng",
      description: "Khám viêm họng, viêm xoang, ù tai, dị ứng mũi và bệnh lý hô hấp trên.",
      image: "https://images.unsplash.com/photo-1580281657527-47f249e8f4df?auto=format&fit=crop&w=1200&q=80",
      symptomKeywords: ["đau họng", "nghẹt mũi", "chảy mũi", "ù tai", "đau tai", "khàn tiếng", "viêm xoang"],
      triageDescription: "Tiếp nhận các triệu chứng ở tai, mũi, họng và đường hô hấp trên.",
    }),
  ]);

  const doctors = await Promise.all(
    doctorUsers.map((user, index) =>
      upsertDoctor({
        userId: user.id,
        departmentId: departments[index].id,
        title: index % 2 === 0 ? "ThS.BS" : "BS.CK1",
        specialization: departments[index].name.replace("Khoa ", ""),
        bio: `Bác sĩ ${user.fullName} có kinh nghiệm khám và tư vấn ${departments[index].name.toLowerCase()}.`,
        experience: 5 + index,
        consultationFee: 150000 + index * 30000,
      }),
    ),
  );

  for (const doctor of doctors) {
    await upsertSchedules(doctor.id);
  }
  const slotCounts = await Promise.all(doctors.map((doctor) => generateSlots(doctor.id)));

  const packages = await Promise.all([
    upsertPackage({
      name: "Gói khám tổng quát cơ bản",
      description: "Phù hợp kiểm tra sức khỏe ban đầu và nhận tư vấn tổng quát.",
      summary: "Khám tổng quát, đo sinh hiệu, tư vấn sức khỏe.",
      departmentId: departments[0].id,
      serviceFee: 20000,
      isPopular: true,
      isBHYTSupport: true,
      items: [
        { name: "Khám lâm sàng tổng quát", description: "Đánh giá triệu chứng và tiền sử sức khỏe.", price: 150000, order: 1 },
        { name: "Đo mạch, nhiệt độ, huyết áp", description: "Ghi nhận sinh hiệu cơ bản.", price: 50000, order: 2 },
        { name: "Tư vấn kết quả", description: "Bác sĩ tư vấn hướng theo dõi phù hợp.", price: 50000, order: 3 },
      ],
    }),
    upsertPackage({
      name: "Gói khám tim mạch cơ bản",
      description: "Dành cho người có triệu chứng hồi hộp, đau ngực, tăng huyết áp.",
      summary: "Khám tim mạch, đo huyết áp, điện tim.",
      departmentId: departments[1].id,
      serviceFee: 30000,
      isPopular: true,
      isBHYTSupport: true,
      items: [
        { name: "Khám chuyên khoa tim mạch", description: "Đánh giá nguy cơ và triệu chứng tim mạch.", price: 220000, order: 1 },
        { name: "Điện tim ECG", description: "Ghi nhận hoạt động điện của tim.", price: 120000, order: 2 },
        { name: "Tư vấn điều trị", description: "Định hướng theo dõi và tái khám.", price: 80000, order: 3 },
      ],
    }),
    upsertPackage({
      name: "Gói khám nhi cơ bản",
      description: "Khám bệnh trẻ em, tư vấn chăm sóc và dinh dưỡng.",
      summary: "Khám nhi, đo sinh hiệu, tư vấn dinh dưỡng.",
      departmentId: departments[2].id,
      serviceFee: 20000,
      isBHYTSupport: true,
      items: [
        { name: "Khám nhi tổng quát", description: "Bác sĩ đánh giá triệu chứng của trẻ.", price: 180000, order: 1 },
        { name: "Theo dõi tăng trưởng", description: "Cân nặng, chiều cao và tư vấn chăm sóc.", price: 70000, order: 2 },
      ],
    }),
    upsertPackage({
      name: "Gói khám thai định kỳ",
      description: "Theo dõi thai kỳ và tư vấn chăm sóc mẹ bầu.",
      summary: "Khám sản, tư vấn thai kỳ và chỉ định xét nghiệm khi cần.",
      departmentId: departments[3].id,
      serviceFee: 40000,
      isPopular: true,
      isBHYTSupport: false,
      items: [
        { name: "Khám sản khoa", description: "Đánh giá sức khỏe mẹ và thai.", price: 260000, order: 1 },
        { name: "Tư vấn thai kỳ", description: "Hướng dẫn chăm sóc và lịch tái khám.", price: 90000, order: 2 },
      ],
    }),
    upsertPackage({
      name: "Gói khám da liễu",
      description: "Khám mụn, viêm da, dị ứng và tư vấn chăm sóc da.",
      summary: "Khám da liễu và xây dựng phác đồ chăm sóc.",
      departmentId: departments[4].id,
      serviceFee: 25000,
      isBHYTSupport: false,
      items: [
        { name: "Soi da và khám da liễu", description: "Đánh giá tình trạng da hiện tại.", price: 200000, order: 1 },
        { name: "Tư vấn phác đồ", description: "Hướng dẫn chăm sóc và dùng thuốc.", price: 80000, order: 2 },
      ],
    }),
    upsertPackage({
      name: "Gói khám tai mũi họng",
      description: "Khám viêm họng, viêm xoang, ù tai và dị ứng mũi.",
      summary: "Khám tai mũi họng, nội soi cơ bản khi cần.",
      departmentId: departments[5].id,
      serviceFee: 25000,
      isBHYTSupport: true,
      items: [
        { name: "Khám tai mũi họng", description: "Đánh giá triệu chứng đường hô hấp trên.", price: 180000, order: 1 },
        { name: "Nội soi tai mũi họng", description: "Kiểm tra tổn thương niêm mạc khi cần.", price: 150000, order: 2 },
      ],
    }),
  ]);

  await upsertSiteContent();
  await upsertChatbotContent();
  await seedAppointments(doctors, packages);
  await seedClinicalFlow();

  await prisma.consultationRequest.createMany({
    data: [
      { fullName: "Nguyễn Lan", phone: "0371111222", message: "Tôi cần tư vấn chọn chuyên khoa cho đau dạ dày.", status: "NEW" },
      { fullName: "Hoàng Minh", phone: "0373333444", message: "Tôi muốn đặt lịch khám tim mạch cuối tuần.", status: "CONTACTED", note: "Đã gọi tư vấn." },
      { fullName: "Trúc Anh", phone: "0375555666", message: "Hỏi về gói khám tổng quát cho gia đình.", status: "NEW" },
    ],
  });

  console.log("Seed demo data completed");
  console.table([
    { key: "adminPhone", value: admin.phone },
    { key: "staffPhone", value: staff.phone },
    { key: "password", value: PASSWORD },
    { key: "departments", value: departments.length },
    { key: "doctors", value: doctors.length },
    { key: "packages", value: packages.length },
    { key: "generatedSlots", value: slotCounts.reduce((total, count) => total + count, 0) },
    { key: "resetDatabase", value: resetRequested ? "yes" : "no" },
  ]);
}

seedDemoData()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
