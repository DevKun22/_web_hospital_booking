import { prisma } from "../config/prisma.js";
import { hashPassword } from "../utils/password.js";
import {
  buildTimeSlots,
  isSlotStartInPastVietnamTime,
} from "../utils/time.js";
import ScheduleReconciliationService from "../services/scheduleReconciliation.service.js";
import { getRuntimeConfig } from "../config/runtimeConfig.js";

const PASSWORD = "@DevKun2212";
const SLOT_DAYS = 14;
const DEMO_INSURANCE_COVERAGE_RATE = 80;
const DEMO_INSURANCE_ELIGIBLE_LIMIT = 62_500;

const runtimeConfig = getRuntimeConfig();
const resetRequested = runtimeConfig.demoSeed.resetRequested;
const resetAllowed = runtimeConfig.demoSeed.resetAllowed;

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

const buildDemoInsurance = (input: {
  hasBHYT: boolean;
  isBHYTSupport: boolean;
  estimatedPrice: number;
}) => {
  const applies = input.hasBHYT && input.isBHYTSupport;
  const eligibleAmount = applies
    ? Math.min(input.estimatedPrice, DEMO_INSURANCE_ELIGIBLE_LIMIT)
    : 0;
  const coverageRate = applies ? DEMO_INSURANCE_COVERAGE_RATE : 0;
  const discountAmount = Math.floor(
    (eligibleAmount * coverageRate) / 100,
  );

  return {
    eligibleAmount,
    coverageRate,
    discountAmount,
    routeType: applies ? ("RIGHT_ROUTE" as const) : null,
    note: applies
      ? "Demo đúng tuyến, áp dụng mức hưởng tham khảo."
      : null,
  };
};

const appointmentLifecycleActions = (status: string) => {
  const actions: Array<
    | "APPOINTMENT_CREATED"
    | "OTP_VERIFIED"
    | "CONFIRMED"
    | "CHECKED_IN"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "CANCELLED_BY_PATIENT"
    | "NO_SHOW"
  > = ["APPOINTMENT_CREATED", "OTP_VERIFIED"];

  if (["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"].includes(status)) actions.push("CONFIRMED");
  if (["CHECKED_IN", "IN_PROGRESS", "COMPLETED"].includes(status)) actions.push("CHECKED_IN");
  if (["IN_PROGRESS", "COMPLETED"].includes(status)) actions.push("IN_PROGRESS");
  if (status === "COMPLETED") actions.push("COMPLETED");
  if (status === "CANCELLED_BY_PATIENT") actions.push("CANCELLED_BY_PATIENT");
  if (status === "NO_SHOW") actions.push("NO_SHOW");

  return actions;
};

async function resetDatabase() {
  if (!resetRequested) return;

  if (!resetAllowed) {
    throw new Error("Reset database bi chan. Hay set RESET_DATABASE=true va ALLOW_DATABASE_RESET=true neu chac chan.");
  }

  await prisma.$transaction([
    // Sổ kho chỉ thêm dòng (trigger chặn DELETE), nên dọn kho bằng TRUNCATE.
    // CASCADE kéo theo PrescriptionItem; mọi dữ liệu đơn thuốc đều bị xóa ở dưới.
    prisma.$executeRawUnsafe(
      'TRUNCATE TABLE "StockMovement", "StockBatch", "Medicine" CASCADE',
    ),
    prisma.paymentTransaction.deleteMany(),
    prisma.invoiceItem.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.prescriptionItem.deleteMany(),
    prisma.prescription.deleteMany(),
    prisma.labResult.deleteMany(),
    prisma.medicalRecord.deleteMany(),
    prisma.review.deleteMany(),
    prisma.notificationDelivery.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.notificationPreference.deleteMany(),
    prisma.authRefreshToken.deleteMany(),
    prisma.dashboardSession.deleteMany(),
    prisma.appointmentLog.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.doctorTimeSlot.deleteMany(),
    prisma.scheduleChangeRequest.deleteMany(),
    prisma.scheduleChangeLog.deleteMany(),
    prisma.doctorSchedule.deleteMany(),
    prisma.packageItem.deleteMany(),
    prisma.package.deleteMany(),
    prisma.doctorProfile.deleteMany(),
    prisma.patientProfile.deleteMany(),
    prisma.dependentProfile.deleteMany(),
    prisma.dashboardLoginChallenge.deleteMany(),
    prisma.dashboardLoginFailure.deleteMany(),
    prisma.otpCode.deleteMany(),
    prisma.otpVerifyAttempt.deleteMany(),
    prisma.otpSecurityBlock.deleteMany(),
    prisma.mediaAsset.deleteMany(),
    prisma.chatbotLog.deleteMany(),
    prisma.chatbotSession.deleteMany(),
    prisma.chatbotSetting.deleteMany(),
    prisma.fAQ.deleteMany(),
    prisma.banner.deleteMany(),
    prisma.siteSetting.deleteMany(),
    prisma.user.deleteMany(),
    prisma.department.deleteMany(),
  ]);
}

async function upsertUser(data: {
  fullName: string;
  phone: string;
  email: string;
  role: "ADMIN" | "STAFF" | "DOCTOR" | "PHARMACIST" | "PATIENT";
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
  fullName: string;
  departmentId: string;
  title: string;
  specialization: string;
  bio: string;
  experience: number;
  consultationFee: number;
}) {
  const { fullName, ...profileData } = data;
  const slug = toSlug(fullName);

  return prisma.doctorProfile.upsert({
    where: { userId: data.userId },
    update: { ...profileData, slug, isAvailable: true },
    create: { ...profileData, slug, isAvailable: true },
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

  const existing =
    (await prisma.package.findUnique({ where: { slug } })) ||
    (await prisma.package.findFirst({ where: { name: data.name } }));
  const packageData = {
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
  };
  const packageItem = existing
    ? await prisma.package.update({ where: { id: existing.id }, data: packageData })
    : await prisma.package.create({ data: packageData });

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

async function backfillMissingPublicSlugs() {
  const departments = await prisma.department.findMany({
    where: { slug: null },
    select: { id: true, name: true },
  });
  const packages = await prisma.package.findMany({
    where: { slug: null },
    select: { id: true, name: true },
  });

  const assignUniqueSlug = async (
    entity: "department" | "package",
    id: string,
    name: string,
  ) => {
    const baseSlug = toSlug(name) || `${entity}-${id.slice(0, 8)}`;
    const conflict = entity === "department"
      ? await prisma.department.findUnique({ where: { slug: baseSlug } })
      : await prisma.package.findUnique({ where: { slug: baseSlug } });
    const slug = conflict && conflict.id !== id
      ? `${baseSlug}-${id.slice(0, 8)}`
      : baseSlug;

    if (entity === "department") {
      await prisma.department.update({ where: { id }, data: { slug } });
    } else {
      await prisma.package.update({ where: { id }, data: { slug } });
    }
  };

  for (const department of departments) {
    await assignUniqueSlug("department", department.id, department.name);
  }
  for (const packageItem of packages) {
    await assignUniqueSlug("package", packageItem.id, packageItem.name);
  }

  return departments.length + packages.length;
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
        linkUrl: "/chuyen-khoa",
        target: "_self",
        position: "HOME_HERO",
        order: 1,
        isActive: true,
      },
      {
        title: "Gói khám tổng quát",
        subtitle: "Tầm soát sức khỏe định kỳ với chi phí minh bạch.",
        image: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1600&q=80",
        linkUrl: "/goi-kham",
        target: "_self",
        position: "HOME_HERO",
        order: 2,
        isActive: true,
      },
      {
        title: "Ưu tiên tư vấn trước khi đến viện",
        subtitle: "Để lại số điện thoại, nhân viên sẽ hỗ trợ lựa chọn lịch khám.",
        image: "https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=1600&q=80",
        linkUrl: "/huong-dan/dat-lich",
        target: "_self",
        position: "HOME_PROMO",
        order: 1,
        isActive: true,
      },
    ],
  });

  // Một bảng FAQ dùng chung cho trang Hỏi đáp và trợ lý ảo.
  await prisma.fAQ.deleteMany({});
  await prisma.fAQ.createMany({
    data: [
      { question: "Tôi đặt lịch khám như thế nào?", answer: "Bạn chọn chuyên khoa, bác sĩ, ngày khám, khung giờ trống và xác thực OTP để hoàn tất đặt lịch.", category: "booking", order: 1, keywords: ["dat lich", "đặt lịch", "huong dan", "hướng dẫn"] },
      { question: "Tôi quên mã lịch thì phải làm sao?", answer: "Bạn không cần mã lịch. Hãy đăng nhập Tài khoản bằng số điện thoại đã đặt lịch và mã OTP để xem, hủy lịch, kết quả và hóa đơn.", category: "booking", order: 2, keywords: ["quen ma", "quên mã", "tra cuu", "tra cứu", "huy lich", "hủy lịch"] },
      { question: "Có hỗ trợ BHYT không?", answer: "Một số gói khám có hỗ trợ BHYT tùy tuyến khám, thông tin thẻ và chính sách hiện hành.", category: "insurance", order: 3, keywords: ["bhyt", "bao hiem", "bảo hiểm"] },
      { question: "Thanh toán hóa đơn ở đâu?", answer: "Bạn có thể thanh toán tại quầy hoặc thanh toán online trong mục Hóa đơn của tài khoản nếu bệnh viện đã cấu hình cổng thanh toán.", category: "payment", order: 4, keywords: ["thanh toan", "thanh toán", "hoa don", "hóa đơn"] },
      { question: "Tôi có thể chọn bác sĩ không?", answer: "Có. Bạn có thể chọn bác sĩ còn lịch trống trong chuyên khoa phù hợp.", category: "doctor", order: 5, keywords: ["chon bac si", "chọn bác sĩ"] },
      { question: "Cần chuẩn bị gì trước khi đi khám?", answer: "Bạn nên mang giấy tờ tùy thân, thẻ BHYT nếu có, đơn thuốc và kết quả xét nghiệm cũ.", category: "general", order: 6, keywords: ["chuan bi", "chuẩn bị", "mang theo"] },
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
        model: runtimeConfig.chatbot.model,
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
        model: runtimeConfig.chatbot.model,
        maxSuggestedActions: 4,
        sessionExpiresDays: 7,
      },
      description: "Cấu hình chatbot demo an toàn",
      isActive: true,
    },
  });


}

async function seedAppointments(doctors: Awaited<ReturnType<typeof upsertDoctor>>[], packages: Awaited<ReturnType<typeof upsertPackage>>[]) {
  const patients = await Promise.all([
    upsertUser({ fullName: "Nguyễn Minh Anh", phone: "0391234567", email: "minhanh@example.com", role: "PATIENT" }),
    upsertUser({ fullName: "Trần Hoàng Nam", phone: "0321258369", email: "hoangnam@example.com", role: "PATIENT" }),
    upsertUser({ fullName: "Lê Thị Bích", phone: "0387654321", email: "lebich@example.com", role: "PATIENT" }),
    upsertUser({ fullName: "Phạm Quốc Huy", phone: "0369988776", email: "quochuy@example.com", role: "PATIENT" }),
  ]);

  const patientProfiles = [
    { dateOfBirth: "1992-04-12", gender: "FEMALE" as const, cccd: "079192001234", address: "Quận Bình Thạnh, TP. Hồ Chí Minh", bloodType: "O+", height: 160, weight: 52, allergies: "Dị ứng hải sản", medicalHistory: "Không ghi nhận bệnh nền.", hasBHYT: true },
    { dateOfBirth: "1988-09-21", gender: "MALE" as const, cccd: "079088005678", address: "TP. Thủ Đức, TP. Hồ Chí Minh", bloodType: "A+", height: 172, weight: 68, allergies: null, medicalHistory: "Tiền sử viêm dạ dày.", hasBHYT: false },
    { dateOfBirth: "1995-01-08", gender: "FEMALE" as const, cccd: "079195009876", address: "Quận 3, TP. Hồ Chí Minh", bloodType: "B+", height: 158, weight: 49, allergies: "Dị ứng penicillin", medicalHistory: "Viêm mũi dị ứng.", hasBHYT: true },
    { dateOfBirth: "1990-11-30", gender: "MALE" as const, cccd: "079090004321", address: "Quận Gò Vấp, TP. Hồ Chí Minh", bloodType: "AB+", height: 175, weight: 72, allergies: null, medicalHistory: "Không ghi nhận bệnh nền.", hasBHYT: false },
  ];

  await Promise.all(
    patients.map((patient, index) => {
      const profile = patientProfiles[index];
      const hasBHYT = profile.hasBHYT;
      return prisma.patientProfile.upsert({
        where: { userId: patient.id },
        update: {
          dateOfBirth: parseDateOnly(profile.dateOfBirth),
          gender: profile.gender,
          cccd: profile.cccd,
          address: profile.address,
          hasBHYT,
          healthInsuranceCode: hasBHYT ? `DN40101234${index}` : null,
          registeredHospital: hasBHYT
            ? "Bệnh viện Quận Bình Thạnh"
            : null,
          bloodType: profile.bloodType,
          height: profile.height,
          weight: profile.weight,
          allergies: profile.allergies,
          medicalHistory: profile.medicalHistory,
          familyHistory: "Chưa ghi nhận.",
        },
        create: {
          userId: patient.id,
          dateOfBirth: parseDateOnly(profile.dateOfBirth),
          gender: profile.gender,
          cccd: profile.cccd,
          address: profile.address,
          hasBHYT,
          healthInsuranceCode: hasBHYT ? `DN40101234${index}` : null,
          registeredHospital: hasBHYT
            ? "Bệnh viện Quận Bình Thạnh"
            : null,
          bloodType: profile.bloodType,
          height: profile.height,
          weight: profile.weight,
          allergies: profile.allergies,
          medicalHistory: profile.medicalHistory,
          familyHistory: "Chưa ghi nhận.",
        },
      });
    }),
  );

  await Promise.all(
    patients.map((patient) => prisma.notificationPreference.upsert({
      where: { userId: patient.id },
      update: {
        appointmentUpdatesPush: true,
        appointmentRemindersPush: true,
        medicalResultsPush: true,
        prescriptionsPush: true,
        billingPush: true,
        generalAnnouncementsPush: true,
      },
      create: { userId: patient.id },
    })),
  );

  const dependent = await prisma.dependentProfile.upsert({
    where: {
      ownerId_cccd: {
        ownerId: patients[0].id,
        cccd: "079215006789",
      },
    },
    update: {
      fullName: "Nguyễn Gia Bảo",
      relationship: "CHILD",
      phone: patients[0].phone,
      dateOfBirth: parseDateOnly("2015-06-18"),
      gender: "MALE",
      address: "Quận Bình Thạnh, TP. Hồ Chí Minh",
      hasBHYT: true,
      healthInsuranceCode: "TE1401523456789",
      registeredHospital: "Bệnh viện Nhi Đồng 2",
      allergies: "Chưa ghi nhận.",
      medicalHistory: "Viêm amidan tái phát.",
      isActive: true,
      consentConfirmedAt: new Date(),
      consentVersion: "v1",
    },
    create: {
      ownerId: patients[0].id,
      fullName: "Nguyễn Gia Bảo",
      relationship: "CHILD",
      phone: patients[0].phone,
      dateOfBirth: parseDateOnly("2015-06-18"),
      gender: "MALE",
      cccd: "079215006789",
      address: "Quận Bình Thạnh, TP. Hồ Chí Minh",
      hasBHYT: true,
      healthInsuranceCode: "TE1401523456789",
      registeredHospital: "Bệnh viện Nhi Đồng 2",
      allergies: "Chưa ghi nhận.",
      medicalHistory: "Viêm amidan tái phát.",
      consentVersion: "v1",
    },
  });

  const statuses = ["PENDING_CONFIRM", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "COMPLETED", "COMPLETED", "CANCELLED_BY_PATIENT", "NO_SHOW"] as const;
  const created = [];

  for (let index = 0; index < statuses.length; index += 1) {
    const doctor = doctors[index % doctors.length];
    const packageItem = packages[index % packages.length];
    const patient = patients[index % patients.length];
    const status = statuses[index];
    const bookingCode = `BKDEMO${String(index + 1).padStart(4, "0")}`;
    const existingAppointment = await prisma.appointment.findUnique({
      where: { bookingCode },
      select: {
        timeSlot: true,
      },
    });
    const requiresUpcomingSlot = [
      "PENDING_CONFIRM",
      "CONFIRMED",
      "CHECKED_IN",
      "IN_PROGRESS",
    ].includes(status);
    const reusableSlot =
      existingAppointment?.timeSlot?.doctorId === doctor.id &&
      (!requiresUpcomingSlot ||
        !isSlotStartInPastVietnamTime(
          existingAppointment.timeSlot.date,
          existingAppointment.timeSlot.startTime,
        ))
        ? existingAppointment.timeSlot
        : null;
    const slotCandidates = reusableSlot
      ? []
      : await prisma.doctorTimeSlot.findMany({
        where: {
          doctorId: doctor.id,
          status: "AVAILABLE",
          date: { gte: getToday() },
          appointment: { is: null },
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        take: 50,
      });
    const slot =
      reusableSlot ||
      slotCandidates.find(
        (candidate) =>
          !requiresUpcomingSlot ||
          !isSlotStartInPastVietnamTime(
            candidate.date,
            candidate.startTime,
          ),
      );

    if (!slot) continue;

    const releasesSlot =
      status === "CANCELLED_BY_PATIENT" || status === "NO_SHOW";
    const hasBHYT = index % 2 === 0;
    const serviceFee = packageItem.serviceFee;
    const estimatedPrice = packageItem.basePrice;
    const insurance = buildDemoInsurance({
      hasBHYT,
      isBHYTSupport: packageItem.isBHYTSupport,
      estimatedPrice,
    });
    const bhytDiscount = insurance.discountAmount;
    const finalAmount = Math.max(0, estimatedPrice + serviceFee - bhytDiscount);
    const reason = index % 2 === 0
      ? "Khám định kỳ và tư vấn sức khỏe."
      : "Đau đầu, mệt mỏi cần kiểm tra.";
    const isDependentBooking = index === 2;
    const patientName = isDependentBooking ? dependent.fullName : patient.fullName;
    const patientGender = isDependentBooking ? dependent.gender : patientProfiles[index % patients.length].gender;
    const patientDateOfBirth = parseDateOnly(
      isDependentBooking
        ? "2015-06-18"
        : patientProfiles[index % patients.length].dateOfBirth,
    );
    const healthInsuranceCode = isDependentBooking
      ? dependent.healthInsuranceCode
      : hasBHYT
        ? `DN40101234${index % patients.length}`
        : null;
    const registeredHospital = isDependentBooking
      ? dependent.registeredHospital
      : hasBHYT
        ? "Bệnh viện Quận Bình Thạnh"
        : null;
    const allergies = index % 3 === 0 ? "Dị ứng hải sản" : null;
    const medicalHistory = index % 2 === 0
      ? "Không ghi nhận bệnh nền."
      : "Tiền sử viêm dạ dày.";

    const appointment = await prisma.appointment.upsert({
      where: { bookingCode },
      update: {
        status,
        appointmentDate: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        reason,
        patientName,
        patientPhone: patient.phone || "",
        patientEmail: patient.email,
        patientGender,
        patientDateOfBirth,
        patientAddress: isDependentBooking ? dependent.address : patientProfiles[index % patients.length].address,
        patientCccd: isDependentBooking ? dependent.cccd : patientProfiles[index % patients.length].cccd,
        hasBHYT,
        healthInsuranceCode,
        registeredHospital,
        allergies,
        medicalHistory,
        familyHistory: "Chưa ghi nhận.",
        estimatedPrice,
        serviceFee,
        bhytDiscount,
        finalAmount,
        patientId: patient.id,
        dependentProfileId: isDependentBooking ? dependent.id : null,
        doctorId: doctor.id,
        departmentId: doctor.departmentId,
        packageId: packageItem.id,
        timeSlotId: releasesSlot ? null : slot.id,
        confirmedAt: ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"].includes(status) ? new Date() : null,
        completedAt: status === "COMPLETED" ? new Date() : null,
        cancelledAt: releasesSlot ? new Date() : null,
      },
      create: {
        bookingCode,
        appointmentDate: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status,
        reason,
        patientName,
        patientPhone: patient.phone || "",
        patientEmail: patient.email,
        patientGender,
        patientDateOfBirth,
        patientAddress: isDependentBooking ? dependent.address : patientProfiles[index % patients.length].address,
        patientCccd: isDependentBooking ? dependent.cccd : patientProfiles[index % patients.length].cccd,
        hasBHYT,
        healthInsuranceCode,
        registeredHospital,
        allergies,
        medicalHistory,
        familyHistory: "Chưa ghi nhận.",
        estimatedPrice,
        serviceFee,
        bhytDiscount,
        finalAmount,
        patientId: patient.id,
        dependentProfileId: isDependentBooking ? dependent.id : null,
        doctorId: doctor.id,
        departmentId: doctor.departmentId,
        packageId: packageItem.id,
        timeSlotId: releasesSlot ? null : slot.id,
        confirmedAt: ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"].includes(status) ? new Date() : null,
        completedAt: status === "COMPLETED" ? new Date() : null,
        cancelledAt: releasesSlot ? new Date() : null,
      },
    });

    await prisma.doctorTimeSlot.update({
      where: { id: slot.id },
      data: { status: releasesSlot ? "AVAILABLE" : "BOOKED" },
    });

    await prisma.appointmentLog.deleteMany({
      where: { appointmentId: appointment.id },
    });
    await prisma.appointmentLog.createMany({
      data: appointmentLifecycleActions(status).map((action) => ({
        appointmentId: appointment.id,
        action,
        note: `Dữ liệu demo: ${action.toLowerCase().replaceAll("_", " ")}.`,
        newDate: slot.date,
        newStartTime: slot.startTime,
        newEndTime: slot.endTime,
      })),
    });

    created.push(appointment);
  }

  return { appointments: created, patients, dependent };
}

async function seedClinicalFlow() {
  const completedAppointments = await prisma.appointment.findMany({
    where: {
      status: "COMPLETED",
      bookingCode: { startsWith: "BKDEMO" },
    },
    take: 4,
    include: { doctor: true, patient: true, package: true },
    orderBy: { createdAt: "asc" },
  });

  for (let index = 0; index < completedAppointments.length; index += 1) {
    const appointment = completedAppointments[index];
    const recordCode = `MRDEMO${String(index + 1).padStart(4, "0")}`;
    const prescriptionCode = `RXDEMO${String(index + 1).padStart(4, "0")}`;
    const invoiceCode = `IVDEMO${String(index + 1).padStart(4, "0")}`;
    const insurance = buildDemoInsurance({
      hasBHYT: appointment.hasBHYT,
      isBHYTSupport: appointment.package?.isBHYTSupport ?? false,
      estimatedPrice: appointment.estimatedPrice,
    });

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

    const invoice = await prisma.invoice.upsert({
      where: { appointmentId: appointment.id },
      update: {
        totalAmount: appointment.estimatedPrice + appointment.serviceFee,
        bhytDiscount: insurance.discountAmount,
        finalAmount:
          appointment.estimatedPrice +
          appointment.serviceFee -
          insurance.discountAmount,
        insuranceEligibleAmount: insurance.eligibleAmount,
        insuranceCoverageRate: insurance.coverageRate,
        insuranceDiscountAmount: insurance.discountAmount,
        insuranceRouteType: insurance.routeType,
        insuranceNote: insurance.note,
        status: index === 0 ? "PAID" : index === 1 ? "UNPAID" : "REFUNDED",
        paymentMethod: index === 1 ? null : "VNPAY",
        paymentReference: index === 1 ? null : `VNPAY-DEMO-${invoiceCode}`,
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
        bhytDiscount: insurance.discountAmount,
        finalAmount:
          appointment.estimatedPrice +
          appointment.serviceFee -
          insurance.discountAmount,
        insuranceEligibleAmount: insurance.eligibleAmount,
        insuranceCoverageRate: insurance.coverageRate,
        insuranceDiscountAmount: insurance.discountAmount,
        insuranceRouteType: insurance.routeType,
        insuranceNote: insurance.note,
        status: index === 0 ? "PAID" : index === 1 ? "UNPAID" : "REFUNDED",
        paymentMethod: index === 1 ? null : "VNPAY",
        paymentReference: index === 1 ? null : `VNPAY-DEMO-${invoiceCode}`,
        paidAt: index === 1 ? null : new Date(),
        refundReason: index > 1 ? "Hoàn tiền demo theo yêu cầu kiểm thử." : null,
        refundedAt: index > 1 ? new Date() : null,
      },
    });

    await prisma.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } });
    await prisma.invoiceItem.createMany({
      data: [
        {
          invoiceId: invoice.id,
          type: appointment.package ? "PACKAGE" : "CONSULTATION",
          description: appointment.package
            ? `Gói khám: ${appointment.package.name}`
            : "Phí khám bác sĩ",
          quantity: 1,
          unitPrice: appointment.estimatedPrice,
          amount: appointment.estimatedPrice,
          sortOrder: 0,
        },
        ...(appointment.serviceFee > 0
          ? [{
              invoiceId: invoice.id,
              type: "SERVICE_FEE" as const,
              description: "Phí dịch vụ đặt lịch",
              quantity: 1,
              unitPrice: appointment.serviceFee,
              amount: appointment.serviceFee,
              sortOrder: 1,
            }]
          : []),
      ],
    });

    await prisma.paymentTransaction.deleteMany({
      where: { invoiceId: invoice.id },
    });
    if (index !== 1) {
      await prisma.paymentTransaction.create({
        data: {
          invoiceId: invoice.id,
          provider: "VNPAY",
          status: "SUCCESS",
          amount: invoice.finalAmount,
          transactionCode: `PAYDEMO${String(index + 1).padStart(4, "0")}`,
          activeKey: `demo-active-${invoice.id}`,
          idempotencyKey: `demo-payment-${invoice.id}`,
          providerOrderId: `VNPAY-DEMO-${invoiceCode}`,
          rawRequest: { source: "seed-demo", invoiceCode },
          rawResponse: { provider: "VNPAY", responseCode: "00", transactionStatus: "00", source: "seed-demo" },
          paidAt: new Date(),
          expiredAt: addDays(new Date(), 1),
        },
      });
    }

    await prisma.review.upsert({
      where: { appointmentId: appointment.id },
      update: {
        rating: index === 0 ? 4.8 : index === 1 ? 4.5 : 4.2,
        doctorRating: index === 0 ? 5 : 4,
        serviceRating: index === 2 ? 4 : 5,
        facilityRating: 4,
        comment: index === 0
          ? "Bác sĩ tư vấn rõ ràng, quy trình tiếp nhận thuận tiện."
          : "Trải nghiệm khám tốt, thông tin lịch hẹn dễ theo dõi.",
        isVisible: true,
        moderationNote: "Đánh giá demo đã duyệt.",
        moderatedAt: new Date(),
      },
      create: {
        appointmentId: appointment.id,
        doctorId: appointment.doctorId,
        rating: index === 0 ? 4.8 : index === 1 ? 4.5 : 4.2,
        doctorRating: index === 0 ? 5 : 4,
        serviceRating: index === 2 ? 4 : 5,
        facilityRating: 4,
        comment: index === 0
          ? "Bác sĩ tư vấn rõ ràng, quy trình tiếp nhận thuận tiện."
          : "Trải nghiệm khám tốt, thông tin lịch hẹn dễ theo dõi.",
        isVisible: true,
        moderationNote: "Đánh giá demo đã duyệt.",
        moderatedAt: new Date(),
      },
    });

    await prisma.appointmentLog.createMany({
      data: [
        { appointmentId: appointment.id, action: "MEDICAL_RESULT_CREATED", note: `Đã phát hành hồ sơ ${record.recordCode}.` },
        { appointmentId: appointment.id, action: "INVOICE_CREATED", note: `Đã tạo hóa đơn ${invoice.invoiceCode}.` },
        ...(index !== 1
          ? [{ appointmentId: appointment.id, action: "PAYMENT_RECORDED" as const, note: "Đã ghi nhận thanh toán VNPay (dữ liệu demo)." }]
          : []),
        ...(index > 1
          ? [{ appointmentId: appointment.id, action: "PAYMENT_REFUNDED" as const, note: "Đã ghi nhận hoàn tiền demo." }]
          : []),
      ],
    });
  }
}

const appointmentNotificationContent = (status: string) => {
  switch (status) {
    case "CONFIRMED":
      return { type: "APPOINTMENT_CONFIRMED" as const, title: "Lịch khám đã được xác nhận", body: "Bệnh viện đã xác nhận lịch khám của bạn." };
    case "CHECKED_IN":
      return { type: "APPOINTMENT_CHECKED_IN" as const, title: "Đã tiếp nhận tại bệnh viện", body: "Bạn đã check-in thành công và đang chờ đến lượt khám." };
    case "IN_PROGRESS":
      return { type: "APPOINTMENT_IN_PROGRESS" as const, title: "Lịch khám đang diễn ra", body: "Bác sĩ đã bắt đầu tiếp nhận lịch khám của bạn." };
    case "COMPLETED":
      return { type: "APPOINTMENT_COMPLETED" as const, title: "Lịch khám đã hoàn tất", body: "Buổi khám đã hoàn tất. Bạn có thể xem hồ sơ và hóa đơn trong ứng dụng." };
    case "CANCELLED_BY_PATIENT":
      return { type: "APPOINTMENT_CANCELLED" as const, title: "Lịch khám đã được hủy", body: "Yêu cầu hủy lịch khám đã được ghi nhận." };
    case "NO_SHOW":
      return { type: "APPOINTMENT_NO_SHOW" as const, title: "Bạn đã bỏ lỡ lịch khám", body: "Lịch khám đã được đánh dấu không đến. Hãy đặt lịch mới nếu vẫn cần thăm khám." };
    default:
      return { type: "APPOINTMENT_REMINDER" as const, title: "Lịch khám đang chờ xác nhận", body: "Bệnh viện đang tiếp nhận và xử lý yêu cầu đặt lịch của bạn." };
  }
};

async function seedNotifications() {
  const appointments = await prisma.appointment.findMany({
    where: { bookingCode: { startsWith: "BKDEMO" } },
    include: {
      doctor: { include: { user: true } },
      medicalRecord: true,
      prescription: true,
      invoice: true,
    },
    orderBy: { bookingCode: "asc" },
  });
  let count = 0;

  for (const appointment of appointments) {
    const content = appointmentNotificationContent(appointment.status);
    await prisma.notification.upsert({
      where: { dedupeKey: `demo:appointment:${appointment.id}:${content.type}` },
      update: {
        type: content.type,
        title: content.title,
        body: content.body,
        entityType: "appointment",
        entityId: appointment.id,
        payload: { bookingCode: appointment.bookingCode, status: appointment.status },
        publishedAt: new Date(),
        cancelledAt: null,
      },
      create: {
        userId: appointment.patientId,
        type: content.type,
        title: content.title,
        body: content.body,
        entityType: "appointment",
        entityId: appointment.id,
        payload: { bookingCode: appointment.bookingCode, status: appointment.status },
        campaignId: "demo-appointment-lifecycle",
        dedupeKey: `demo:appointment:${appointment.id}:${content.type}`,
        publishedAt: new Date(),
      },
    });
    count += 1;

    const clinicalNotifications = [
      appointment.medicalRecord
        ? { type: "MEDICAL_RESULT_PUBLISHED" as const, suffix: "medical-result", title: "Kết quả khám đã sẵn sàng", body: `Hồ sơ ${appointment.medicalRecord.recordCode} đã được phát hành.`, entityType: "medical_record", entityId: appointment.medicalRecord.id }
        : null,
      appointment.prescription
        ? { type: "PRESCRIPTION_ISSUED" as const, suffix: "prescription", title: "Đơn thuốc đã được phát hành", body: `Đơn thuốc ${appointment.prescription.prescriptionCode} đã có trong hồ sơ của bạn.`, entityType: "prescription", entityId: appointment.prescription.id }
        : null,
      appointment.invoice
        ? { type: "INVOICE_CREATED" as const, suffix: "invoice", title: "Hóa đơn khám bệnh đã được tạo", body: `Hóa đơn ${appointment.invoice.invoiceCode} đã sẵn sàng để tra cứu.`, entityType: "invoice", entityId: appointment.invoice.id }
        : null,
      appointment.invoice?.status === "PAID"
        ? { type: "PAYMENT_SUCCEEDED" as const, suffix: "payment", title: "Thanh toán thành công", body: `Hóa đơn ${appointment.invoice.invoiceCode} đã được thanh toán.`, entityType: "invoice", entityId: appointment.invoice.id }
        : null,
      appointment.invoice?.status === "REFUNDED"
        ? { type: "PAYMENT_REFUNDED" as const, suffix: "refund", title: "Hoàn tiền đã được ghi nhận", body: `Hóa đơn ${appointment.invoice.invoiceCode} đã được hoàn tiền trong dữ liệu demo.`, entityType: "invoice", entityId: appointment.invoice.id }
        : null,
    ].filter((item): item is NonNullable<typeof item> => item !== null);

    for (const item of clinicalNotifications) {
      const dedupeKey = `demo:appointment:${appointment.id}:${item.suffix}`;
      await prisma.notification.upsert({
        where: { dedupeKey },
        update: {
          type: item.type,
          title: item.title,
          body: item.body,
          entityType: item.entityType,
          entityId: item.entityId,
          publishedAt: new Date(),
          cancelledAt: null,
        },
        create: {
          userId: appointment.patientId,
          type: item.type,
          title: item.title,
          body: item.body,
          entityType: item.entityType,
          entityId: item.entityId,
          payload: { bookingCode: appointment.bookingCode },
          campaignId: "demo-clinical-flow",
          dedupeKey,
          publishedAt: new Date(),
        },
      });
      count += 1;
    }
  }

  const patients = await prisma.user.findMany({
    where: { role: "PATIENT", phone: { in: ["0391234567", "0321258369", "0387654321", "0369988776"] } },
    select: { id: true },
  });
  for (const patient of patients) {
    await prisma.notification.upsert({
      where: { dedupeKey: `demo:announcement:${patient.id}:welcome` },
      update: {
        title: "Chào mừng bạn đến với Hospital Booking",
        body: "Bạn có thể đặt lịch, theo dõi trạng thái khám và xem hồ sơ y tế ngay trên ứng dụng.",
        publishedAt: new Date(),
        cancelledAt: null,
      },
      create: {
        userId: patient.id,
        type: "SYSTEM_ANNOUNCEMENT",
        title: "Chào mừng bạn đến với Hospital Booking",
        body: "Bạn có thể đặt lịch, theo dõi trạng thái khám và xem hồ sơ y tế ngay trên ứng dụng.",
        entityType: "home",
        payload: { source: "demo-seed" },
        campaignId: "demo-welcome",
        dedupeKey: `demo:announcement:${patient.id}:welcome`,
        publishedAt: new Date(),
      },
    });
    count += 1;
  }

  return count;
}

// Thuốc mẫu cho màn hình dược sĩ. Chỉ tạo thuốc chưa có, kèm một phiếu nhập đầu kỳ,
// nên chạy lại seed không làm tồn kho đã thay đổi bị ghi đè hay nhân đôi.
const DEMO_MEDICINES = [
  { code: "PARA500", name: "Paracetamol", strength: "500mg", dosageForm: "Viên nén", unit: "viên", stock: 500, minStock: 100 },
  { code: "VITC500", name: "Vitamin C", strength: "500mg", dosageForm: "Viên nén", unit: "viên", stock: 300, minStock: 50 },
  { code: "AMOX500", name: "Amoxicillin", strength: "500mg", dosageForm: "Viên nang", unit: "viên", stock: 200, minStock: 60 },
  { code: "ORS", name: "Oresol", strength: null, dosageForm: "Gói bột", unit: "gói", stock: 80, minStock: 100 },
];

async function seedDemoMedicines(actorId: string) {
  let created = 0;
  for (const item of DEMO_MEDICINES) {
    if (await prisma.medicine.findUnique({ where: { code: item.code }, select: { id: true } })) continue;
    await prisma.$transaction(async (tx) => {
      const medicine = await tx.medicine.create({
        data: {
          code: item.code,
          name: item.name,
          strength: item.strength,
          dosageForm: item.dosageForm,
          unit: item.unit,
          minStock: item.minStock,
          stockQuantity: item.stock,
        },
      });
      await tx.stockMovement.create({
        data: {
          medicineId: medicine.id,
          type: "RECEIPT",
          quantity: item.stock,
          balanceAfter: item.stock,
          reason: "Nhập tồn đầu kỳ (dữ liệu demo)",
          actorId,
        },
      });
    });
    created += 1;
  }
  return created;
}

// Lô mẫu để màn hình kho và dược sĩ có đủ trạng thái hạn dùng: còn hạn lâu, sắp hết hạn và đã hết hạn.
// Chỉ thêm cho thuốc chưa có lô nào; số lượng lô lấy từ phần tồn sẵn có (không đổi tồn tổng, không thêm dòng sổ kho).
const DEMO_BATCHES: Record<string, { batchNumber: string; days: number; share: number }[]> = {
  PARA500: [
    { batchNumber: "PA2611A", days: 420, share: 0.6 },
    { batchNumber: "PA2603B", days: 35, share: 0.2 },
  ],
  VITC500: [{ batchNumber: "VC2609A", days: 300, share: 0.7 }],
  AMOX500: [
    { batchNumber: "AM2610A", days: 240, share: 0.5 },
    { batchNumber: "AM2512X", days: -12, share: 0.1 },
  ],
  ORS: [{ batchNumber: "OR2605A", days: 50, share: 0.5 }],
};

async function seedDemoBatches() {
  const vietnamToday = Date.parse(`${new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10)}T00:00:00Z`);
  let created = 0;
  for (const [code, batches] of Object.entries(DEMO_BATCHES)) {
    const medicine = await prisma.medicine.findUnique({
      where: { code },
      select: { id: true, stockQuantity: true, _count: { select: { batches: true } } },
    });
    if (!medicine || medicine._count.batches > 0) continue;
    let remaining = medicine.stockQuantity;
    for (const batch of batches) {
      const quantity = Math.min(Math.max(Math.floor(medicine.stockQuantity * batch.share), 1), remaining);
      if (quantity <= 0) continue;
      remaining -= quantity;
      await prisma.stockBatch.create({
        data: {
          medicineId: medicine.id,
          batchNumber: batch.batchNumber,
          expiryDate: new Date(vietnamToday + batch.days * 86_400_000),
          receivedQuantity: quantity,
          quantity,
        },
      });
      created += 1;
    }
  }
  return created;
}

async function seedDemoData() {
  await resetDatabase();

  const [admin, staff, pharmacist, ...doctorUsers] = await Promise.all([
    upsertUser({ fullName: "Quản trị viên Demo", phone: "0352412318", email: "devkun22@gmail.com", role: "ADMIN", password: PASSWORD }),
    upsertUser({ fullName: "Nhân viên Tiếp nhận", phone: "0352147201", email: "staff.demo@hospital.test", role: "STAFF", password: PASSWORD }),
    upsertUser({ fullName: "Dược sĩ Demo", phone: "0352147208", email: "pharmacist.demo@hospital.test", role: "PHARMACIST", password: PASSWORD }),
    upsertUser({ fullName: "Nguyễn Minh Hùng", phone: "0352147202", email: "doctor.nguyenminhhung@hospital.test", role: "DOCTOR", password: PASSWORD, avatar: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=480&q=85" }),
    upsertUser({ fullName: "Trần Thị Mai", phone: "0352147203", email: "doctor.tranthimai@hospital.test", role: "DOCTOR", password: PASSWORD, avatar: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=480&q=85" }),
    upsertUser({ fullName: "Lê Hoàng An", phone: "0352412319", email: "doctor.pediatric@hospital.test", role: "DOCTOR", password: PASSWORD, avatar: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=480&q=85" }),
    upsertUser({ fullName: "Phạm An Nhiên", phone: "0352147205", email: "doctor.obgyn@hospital.test", role: "DOCTOR", password: PASSWORD, avatar: "https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&w=480&q=85" }),
    upsertUser({ fullName: "Đỗ Quang Huy", phone: "0352147206", email: "doctor.derma@hospital.test", role: "DOCTOR", password: PASSWORD, avatar: "https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=480&q=85" }),
    upsertUser({ fullName: "Võ Thanh Tâm", phone: "0352147207", email: "doctor.ent@hospital.test", role: "DOCTOR", password: PASSWORD, avatar: "https://images.unsplash.com/photo-1651008376811-b90baee60c1f?auto=format&fit=crop&w=480&q=85" }),
  ]);

  const medicinesCreated = await seedDemoMedicines(admin.id);
  const batchesCreated = await seedDemoBatches();

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
        fullName: user.fullName,
        departmentId: departments[index].id,
        title: ["BS.CKII", "BS.CKI", "ThS.BS", "BS.CKI", "BS.CKII", "ThS.BS"][index],
        specialization: departments[index].name.replace("Khoa ", ""),
        bio: `Bác sĩ ${user.fullName} có kinh nghiệm khám và tư vấn ${departments[index].name.toLowerCase()}.`,
        experience: 8 + index * 2,
        consultationFee: 200000 + index * 25000,
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
  const bookingSeed = await seedAppointments(doctors, packages);
  const reconciliation = await ScheduleReconciliationService.reconcile({
    repair: true,
  });
  await seedClinicalFlow();
  const notificationCount = await seedNotifications();
  const backfilledSlugs = await backfillMissingPublicSlugs();

  console.log("Seed demo data completed");
  console.table([
    { key: "adminPhone", value: admin.phone },
    { key: "staffPhone", value: staff.phone },
    { key: "pharmacistPhone", value: pharmacist.phone },
    { key: "medicinesCreated", value: medicinesCreated },
    { key: "batchesCreated", value: batchesCreated },
    { key: "password", value: PASSWORD },
    { key: "departments", value: departments.length },
    { key: "doctors", value: doctors.length },
    { key: "packages", value: packages.length },
    { key: "appointments", value: bookingSeed.appointments.length },
    { key: "dependents", value: 1 },
    { key: "notifications", value: notificationCount },
    { key: "backfilledSlugs", value: backfilledSlugs },
    { key: "generatedSlots", value: slotCounts.reduce((total, count) => total + count, 0) },
    { key: "reconciledSlots", value: reconciliation.repairedCount },
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
