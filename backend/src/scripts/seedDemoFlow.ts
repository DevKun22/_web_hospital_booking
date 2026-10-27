import { prisma } from "../config/prisma.js";
import { hashPassword } from "../utils/password.js";
import { buildTimeSlots } from "../utils/time.js";

const PASSWORD = "123456";
const SLOT_DAYS = 14;

const toDateOnly = (date: Date) => date.toISOString().slice(0, 10);

const parseDateOnly = (date: string) => new Date(`${date}T00:00:00.000Z`);

const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
};

const upsertDashboardUser = async (data: {
  fullName: string;
  phone: string;
  email: string;
  role: "ADMIN" | "STAFF" | "DOCTOR";
  password: string;
}) => {
  const hashedPassword = await hashPassword(data.password);

  return prisma.user.upsert({
    where: {
      phone: data.phone,
    },
    update: {
      fullName: data.fullName,
      email: data.email,
      password: hashedPassword,
      role: data.role,
      isActive: true,
      isPhoneVerified: true,
      isEmailVerified: true,
    },
    create: {
      fullName: data.fullName,
      phone: data.phone,
      email: data.email,
      password: hashedPassword,
      role: data.role,
      isActive: true,
      isPhoneVerified: true,
      isEmailVerified: true,
    },
  });
};

const upsertDepartment = (data: {
  name: string;
  slug: string;
  description: string;
  image?: string;
}) =>
  prisma.department.upsert({
    where: {
      name: data.name,
    },
    update: {
      slug: data.slug,
      description: data.description,
      image: data.image,
      isActive: true,
    },
    create: {
      name: data.name,
      slug: data.slug,
      description: data.description,
      image: data.image,
      isActive: true,
    },
  });

const upsertDoctorProfile = async (data: {
  userId: string;
  slug: string;
  departmentId: string;
  title: string;
  specialization: string;
  bio: string;
  experience: number;
  consultationFee: number;
}) =>
  prisma.doctorProfile.upsert({
    where: {
      userId: data.userId,
    },
    update: {
      slug: data.slug,
      departmentId: data.departmentId,
      title: data.title,
      specialization: data.specialization,
      bio: data.bio,
      experience: data.experience,
      consultationFee: data.consultationFee,
      isAvailable: true,
    },
    create: {
      slug: data.slug,
      userId: data.userId,
      departmentId: data.departmentId,
      title: data.title,
      specialization: data.specialization,
      bio: data.bio,
      experience: data.experience,
      consultationFee: data.consultationFee,
      isAvailable: true,
    },
  });

const upsertPackage = async (data: {
  name: string;
  slug: string;
  description: string;
  summary: string;
  departmentId: string;
  basePrice: number;
  serviceFee: number;
  isPopular?: boolean;
  isBHYTSupport?: boolean;
  items: {
    name: string;
    description?: string;
    price?: number;
    included?: boolean;
    order: number;
  }[];
}) => {
  const packageItem = await prisma.package.upsert({
    where: {
      slug: data.slug,
    },
    update: {
      name: data.name,
      description: data.description,
      summary: data.summary,
      departmentId: data.departmentId,
      basePrice: data.basePrice,
      serviceFee: data.serviceFee,
      isPopular: data.isPopular ?? false,
      isBHYTSupport: data.isBHYTSupport ?? false,
      isActive: true,
    },
    create: {
      name: data.name,
      slug: data.slug,
      description: data.description,
      summary: data.summary,
      departmentId: data.departmentId,
      basePrice: data.basePrice,
      serviceFee: data.serviceFee,
      isPopular: data.isPopular ?? false,
      isBHYTSupport: data.isBHYTSupport ?? false,
      isActive: true,
    },
  });

  await prisma.packageItem.deleteMany({
    where: {
      packageId: packageItem.id,
    },
  });

  await prisma.packageItem.createMany({
    data: data.items.map((item) => ({
      packageId: packageItem.id,
      name: item.name,
      description: item.description,
      price: item.price ?? 0,
      included: item.included ?? true,
      order: item.order,
    })),
  });

  return packageItem;
};

const upsertSchedule = async (data: {
  doctorId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDuration: number;
  maxPatients: number;
}) => {
  const existing = await prisma.doctorSchedule.findFirst({
    where: {
      doctorId: data.doctorId,
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
    },
  });

  if (existing) {
    return prisma.doctorSchedule.update({
      where: {
        id: existing.id,
      },
      data: {
        slotDuration: data.slotDuration,
        maxPatients: data.maxPatients,
        isActive: true,
      },
    });
  }

  return prisma.doctorSchedule.create({
    data: {
      doctorId: data.doctorId,
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
      slotDuration: data.slotDuration,
      maxPatients: data.maxPatients,
      isActive: true,
    },
  });
};

const generateSlotsForDoctor = async (doctorId: string) => {
  const today = parseDateOnly(toDateOnly(new Date()));
  let generated = 0;

  for (let offset = 0; offset < SLOT_DAYS; offset += 1) {
    const date = addDays(today, offset);
    const schedules = await prisma.doctorSchedule.findMany({
      where: {
        doctorId,
        dayOfWeek: date.getUTCDay(),
        isActive: true,
      },
    });

    const slotData = schedules.flatMap((schedule) =>
      buildTimeSlots(schedule.startTime, schedule.endTime, schedule.slotDuration).map((slot) => ({
        doctorId,
        date,
        startTime: slot.startTime,
        endTime: slot.endTime,
      })),
    );

    if (slotData.length) {
      await prisma.doctorTimeSlot.createMany({
        data: slotData,
        skipDuplicates: true,
      });
      generated += slotData.length;
    }
  }

  return generated;
};

async function seedDemoFlow() {
  const [admin, staff, cardioDoctorUser, generalDoctorUser] = await Promise.all([
    upsertDashboardUser({
      fullName: "Admin Demo",
      phone: "0352147200",
      email: "admin.demo@hospital.test",
      role: "ADMIN",
      password: PASSWORD,
    }),
    upsertDashboardUser({
      fullName: "Staff Demo",
      phone: "0352147201",
      email: "staff.demo@hospital.test",
      role: "STAFF",
      password: PASSWORD,
    }),
    upsertDashboardUser({
      fullName: "Nguyen Van Bac Si",
      phone: "0352147202",
      email: "doctor.cardio@hospital.test",
      role: "DOCTOR",
      password: PASSWORD,
    }),
    upsertDashboardUser({
      fullName: "Tran Thi Bac Si",
      phone: "0352147203",
      email: "doctor.general@hospital.test",
      role: "DOCTOR",
      password: PASSWORD,
    }),
  ]);

  const [cardiology, general] = await Promise.all([
    upsertDepartment({
      name: "Khoa Tim mach",
      slug: "khoa-tim-mach",
      description: "Kham va dieu tri cac benh ly tim mach.",
      image: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
    }),
    upsertDepartment({
      name: "Khoa Tong quat",
      slug: "khoa-tong-quat",
      description: "Kham tong quat va tam soat suc khoe ban dau.",
      image: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
    }),
  ]);

  const [cardioDoctor, generalDoctor] = await Promise.all([
    upsertDoctorProfile({
      userId: cardioDoctorUser.id,
      slug: "nguyen-van-bac-si",
      departmentId: cardiology.id,
      title: "ThS.BS",
      specialization: "Tim mach",
      bio: "Bac si chuyen khoa tim mach voi kinh nghiem dieu tri tang huyet ap va benh mach vanh.",
      experience: 8,
      consultationFee: 200000,
    }),
    upsertDoctorProfile({
      userId: generalDoctorUser.id,
      slug: "tran-thi-bac-si",
      departmentId: general.id,
      title: "BS.CK1",
      specialization: "Kham tong quat",
      bio: "Bac si phu trach kham tong quat, tu van suc khoe va dieu tri ban dau.",
      experience: 6,
      consultationFee: 150000,
    }),
  ]);

  const [cardioPackage, generalPackage] = await Promise.all([
    upsertPackage({
      name: "Goi kham Tim mach co ban",
      slug: "goi-kham-tim-mach-co-ban",
      description: "Goi kham danh cho nguoi co trieu chung dau nguc, kho tho, hoi hop.",
      summary: "Kham tim mach, do huyet ap, dien tim va tu van dieu tri.",
      departmentId: cardiology.id,
      basePrice: 350000,
      serviceFee: 30000,
      isPopular: true,
      isBHYTSupport: true,
      items: [
        { name: "Kham lam sang tim mach", order: 1 },
        { name: "Do huyet ap", order: 2 },
        { name: "Dien tim ECG", order: 3 },
        { name: "Tu van ket qua", order: 4 },
      ],
    }),
    upsertPackage({
      name: "Goi kham Tong quat co ban",
      slug: "goi-kham-tong-quat-co-ban",
      description: "Goi kham danh cho benh nhan can tam soat suc khoe ban dau.",
      summary: "Kham tong quat, danh gia trieu chung va tu van huong dieu tri.",
      departmentId: general.id,
      basePrice: 250000,
      serviceFee: 20000,
      isPopular: false,
      isBHYTSupport: true,
      items: [
        { name: "Kham lam sang tong quat", order: 1 },
        { name: "Do mach, nhiet do, huyet ap", order: 2 },
        { name: "Tu van suc khoe", order: 3 },
      ],
    }),
  ]);

  for (const doctor of [cardioDoctor, generalDoctor]) {
    for (const dayOfWeek of [1, 2, 3, 4, 5]) {
      await upsertSchedule({
        doctorId: doctor.id,
        dayOfWeek,
        startTime: "08:00",
        endTime: "11:30",
        slotDuration: 30,
        maxPatients: 1,
      });
    }
  }

  const [cardioSlotCount, generalSlotCount] = await Promise.all([
    generateSlotsForDoctor(cardioDoctor.id),
    generateSlotsForDoctor(generalDoctor.id),
  ]);

  console.log("Seed demo flow completed");
  console.table([
    { key: "adminPhone", value: admin.phone },
    { key: "staffPhone", value: staff.phone },
    { key: "doctorCardioPhone", value: cardioDoctorUser.phone },
    { key: "doctorGeneralPhone", value: generalDoctorUser.phone },
    { key: "password", value: PASSWORD },
    { key: "cardiologyDepartmentId", value: cardiology.id },
    { key: "generalDepartmentId", value: general.id },
    { key: "cardioDoctorId", value: cardioDoctor.id },
    { key: "generalDoctorId", value: generalDoctor.id },
    { key: "cardioPackageId", value: cardioPackage.id },
    { key: "generalPackageId", value: generalPackage.id },
    { key: "cardioGeneratedSlots", value: cardioSlotCount },
    { key: "generalGeneratedSlots", value: generalSlotCount },
  ]);
}

seedDemoFlow()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
