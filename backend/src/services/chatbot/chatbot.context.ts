import { TtlCache } from "../../utils/ttlCache.js";
import { prisma } from "../../config/prisma.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { getVietnamNowParts, parseDateOnly } from "../../utils/time.js";
import type { ChatBookingDraft, ChatIntent } from "./chatbot.types.js";
import type { NLUCatalog } from "./ai/nlu.service.js";
import { getRuntimeConfig } from "../../config/runtimeConfig.js";

export type ChatbotContext = {
  departments: {
    id: string;
    name: string;
    slug: string | null;
    description: string | null;
    symptomKeywords: string[];
    triageDescription: string | null;
    isTriageFallback: boolean;
  }[];
  packages: {
    id: string;
    name: string;
    slug: string | null;
    departmentId: string | null;
    departmentName: string | null;
    summary: string | null;
    finalPrice: number;
  }[];
  doctors: {
    id: string;
    fullName: string;
    title: string | null;
    specialization: string | null;
    departmentId: string;
    departmentName: string;
    consultationFee: number;
  }[];
  availableSlots: {
    id: string;
    doctorId: string;
    date: string;
    startTime: string;
    endTime: string;
  }[];
};

// Cột ngày lưu lúc 00:00 UTC (xem parseDateOnly), nên cắt chuỗi ISO là ra đúng ngày.
const toDateOnly = (date: Date) => date.toISOString().slice(0, 10);

const nluCatalogCache = new TtlCache<NLUCatalog>(1, 60_000);

const contextCacheTtlMs = getRuntimeConfig().chatbot.contextCacheTtlMs;

// Đệm danh mục cho trợ lý ảo; các yêu cầu cùng lúc với cùng khóa dùng chung một lần tải. TTL 0 là tắt đệm.
const contextCache = new TtlCache<unknown>(200, contextCacheTtlMs);

const loadCached = <T>(key: string, loader: () => Promise<T>) =>
  contextCacheTtlMs
    ? (contextCache.getOrLoad(key, loader) as Promise<T>)
    : loader();

class ChatbotContextService {
  /** Xóa bộ nhớ đệm danh mục (khoa, gói, bác sĩ, lịch trống) để lần sau đọc lại từ DB. */
  invalidate() {
    contextCache.clear();
    nluCatalogCache.clear();
  }

  loadNLUCatalog(): Promise<NLUCatalog> {
    return nluCatalogCache.getOrLoad("catalog", async () => {
      const [departments, packages, doctors] = await Promise.all([
        prisma.department.findMany({
          where: { isActive: true },
          select: { name: true },
          orderBy: { name: "asc" },
          take: 50,
        }),
        prisma.package.findMany({
          where: { isActive: true },
          select: { name: true },
          orderBy: { name: "asc" },
          take: 50,
        }),
        prisma.doctorProfile.findMany({
          where: { isAvailable: true, user: { isActive: true } },
          select: {
            title: true,
            user: { select: { fullName: true } },
          },
          orderBy: { user: { fullName: "asc" } },
          take: 50,
        }),
      ]);

      // AI receives only lightweight names for language resolution. IDs, prices
      // and slots stay server-side and are verified after extraction.
      const value: NLUCatalog = {
        departments: departments.map((item) => item.name),
        packages: packages.map((item) => item.name),
        doctors: doctors.map((item) =>
          [item.title, item.user.fullName].filter(Boolean).join(" "),
        ),
      };

      return value;
    });
  }

  async load(
    intent: ChatIntent,
    draft: ChatBookingDraft,
  ): Promise<ChatbotContext> {
    const shouldLoadPackages =
      [
        "SYMPTOM_TRIAGE",
        "DEPARTMENT_LIST",
        "DEPARTMENT_DETAIL",
        "PACKAGE_LIST",
        "PACKAGE_DETAIL",
        "BOOKING_START",
        "BOOKING_FORM_HELP",
      ].includes(intent) || Boolean(draft.departmentId || draft.packageId);
    const shouldLoadDoctors =
      [
        "DOCTOR_LIST",
        "AVAILABLE_SLOT_LOOKUP",
        "BOOKING_START",
        "BOOKING_FORM_HELP",
      ].includes(intent) || Boolean(draft.departmentId || draft.doctorId);
    const [departments, packages, doctors, availableSlots] =
      await Promise.all([
        this.getDepartments(),
        shouldLoadPackages ? this.getPackages(draft) : Promise.resolve([]),
        shouldLoadDoctors ? this.getDoctors(draft) : Promise.resolve([]),
        intent === "AVAILABLE_SLOT_LOOKUP" ||
        intent === "DOCTOR_LIST" ||
        draft.doctorId ||
        draft.departmentId
          ? this.getAvailableSlots(draft)
          : Promise.resolve([]),
      ]);

    return {
      departments,
      packages,
      doctors,
      availableSlots,
    };
  }

  private async getDepartments() {
    return loadCached("departments", () =>
      prisma.department.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          symptomKeywords: true,
          triageDescription: true,
          isTriageFallback: true,
        },
        orderBy: {
          name: "asc",
        },
        take: 100,
      }),
    );
  }

  private async getPackages(draft: ChatBookingDraft) {
    const cacheKey = `packages:${draft.departmentId || "all"}`;
    const packages = await loadCached(cacheKey, () =>
      prisma.package.findMany({
        where: {
          isActive: true,
          departmentId: draft.departmentId,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          departmentId: true,
          basePrice: true,
          serviceFee: true,
          summary: true,
          items: {
            select: {
              price: true,
              included: true,
            },
          },
          department: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [{ isPopular: "desc" }, { basePrice: "asc" }],
        take: 10,
      }),
    );

    return packages.map((item) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      departmentId: item.departmentId,
      departmentName: item.department?.name || null,
      summary: item.summary,
      finalPrice:
        (item.items
          .filter((packageItem) => packageItem.included)
          .reduce((total, packageItem) => total + packageItem.price, 0) ||
          item.basePrice) + item.serviceFee,
    }));
  }

  private async getDoctors(draft: ChatBookingDraft) {
    const cacheKey = `doctors:${draft.departmentId || "all"}`;
    const doctors = await loadCached(cacheKey, () =>
      prisma.doctorProfile.findMany({
        where: {
          isAvailable: true,
          departmentId: draft.departmentId,
          user: {
            isActive: true,
          },
          department: {
            isActive: true,
          },
        },
        select: {
          id: true,
          title: true,
          specialization: true,
          departmentId: true,
          consultationFee: true,
          user: {
            select: {
              fullName: true,
            },
          },
          department: {
            select: {
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
        take: 10,
      }),
    );

    return doctors.map((doctor) => ({
      id: doctor.id,
      fullName: doctor.user.fullName,
      title: doctor.title,
      specialization: doctor.specialization,
      departmentId: doctor.departmentId,
      departmentName: doctor.department.name,
      consultationFee: doctor.consultationFee,
    }));
  }

  private async getAvailableSlots(draft: ChatBookingDraft): Promise<ChatbotContext["availableSlots"]> {
    const now = getVietnamNowParts();
    const today = now.date;
    const requestedDate = draft.date && draft.date >= today ? draft.date : undefined;
    // Lọc buổi, giờ và giờ đã qua NGAY TRONG TRUY VẤN rồi mới giới hạn số dòng: lọc sau `take` từng làm mất hết lịch buổi chiều
    // (20 khung đầu ngày toàn buổi sáng). Giờ lưu dạng chuỗi HH:mm đủ hai chữ số nên so sánh chuỗi đúng thứ tự thời gian.
    const periodFilter = draft.preferredTime ? {} : startTimeOfPeriod(draft.timePeriod);
    const notPast: Prisma.DoctorTimeSlotWhereInput = {
      OR: [{ date: { gt: parseDateOnly(today) } }, { date: parseDateOnly(today), startTime: { gt: now.time } }],
    };
    const baseWhere: Prisma.DoctorTimeSlotWhereInput = {
      ...(draft.doctorId ? { doctorId: draft.doctorId } : {}),
      status: "AVAILABLE",
      appointment: { is: null },
      doctor: {
        ...(draft.departmentId ? { departmentId: draft.departmentId } : {}),
        isAvailable: true,
        user: { isActive: true },
      },
      ...(Object.keys(periodFilter).length ? { startTime: periodFilter } : {}),
      AND: [notPast],
    };

    const findSlots = (date: Date | { gte: Date }, take: number) =>
      prisma.doctorTimeSlot.findMany({
        where: { ...baseWhere, date },
        select: { id: true, doctorId: true, date: true, startTime: true, endTime: true },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        take,
      });

    // Hỏi đúng một giờ: lấy cả ngày đó rồi xếp theo độ gần với giờ muốn, giờ khớp đúng đứng đầu, kèm vài giờ gần nhất để chọn thay.
    const limit = draft.preferredTime ? 60 : SLOT_RESULT_LIMIT;
    let slots = requestedDate ? await findSlots(parseDateOnly(requestedDate), limit) : await findSlots({ gte: parseDateOnly(today) }, limit);
    // Ngày yêu cầu không còn lịch phù hợp: tìm từ ngày đó trở đi (luồng sẽ nói rõ là ngày khác).
    if (requestedDate && !slots.length) slots = await findSlots({ gte: parseDateOnly(requestedDate) }, limit);

    let mapped = slots.map((slot) => ({
      id: slot.id,
      doctorId: slot.doctorId,
      date: toDateOnly(slot.date),
      startTime: slot.startTime,
      endTime: slot.endTime,
    }));
    if (draft.preferredTime) {
      const wanted = minutesOf(draft.preferredTime);
      const firstDate = mapped[0]?.date;
      mapped = mapped
        .filter((slot) => slot.date === firstDate)
        .sort((a, b) => Math.abs(minutesOf(a.startTime) - wanted) - Math.abs(minutesOf(b.startTime) - wanted) || a.startTime.localeCompare(b.startTime))
        .slice(0, PREFERRED_TIME_ALTERNATIVES);
    }
    return mapped;
  }
}

/** Số khung giờ nạp cho một lần trả lời (khung chat chỉ hiện vài khung đầu). */
const SLOT_RESULT_LIMIT = 20;
/** Hỏi một giờ cụ thể: trả giờ đó (nếu còn) và tối đa chừng này giờ gần nhất. */
const PREFERRED_TIME_ALTERNATIVES = 6;

const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** Điều kiện giờ bắt đầu của từng buổi, áp ở truy vấn DB: sáng trước 12:00, chiều 12:00–17:59, tối từ 18:00. */
export const startTimeOfPeriod = (period: ChatBookingDraft["timePeriod"]): Prisma.StringFilter => {
  if (period === "MORNING") return { lt: "12:00" };
  if (period === "AFTERNOON") return { gte: "12:00", lt: "18:00" };
  if (period === "EVENING") return { gte: "18:00" };
  return {};
};

export default new ChatbotContextService();
