import { prisma } from "../../config/prisma.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import {
  isSlotStartInPastVietnamTime,
  parseDateOnly,
} from "../../utils/time.js";
import type { ChatBookingDraft, ChatIntent } from "./chatbot.types.js";
import type { NLUCatalog } from "./ai/nlu.service.js";

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

const toDateOnly = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
};

const matchesTimePeriod = (
  startTime: string,
  period: ChatBookingDraft["timePeriod"],
) => {
  if (!period) return true;

  const hour = Number(startTime.slice(0, 2));
  if (period === "MORNING") return hour < 12;
  if (period === "AFTERNOON") return hour >= 12 && hour < 18;
  return hour >= 18;
};

let nluCatalogCache:
  | { value: NLUCatalog; expiresAt: number }
  | undefined;

const rawContextCacheTtl = Number(
  process.env.CHATBOT_CONTEXT_CACHE_TTL_MS || 30_000,
);
const contextCacheTtlMs = Number.isFinite(rawContextCacheTtl)
  ? Math.min(Math.max(rawContextCacheTtl, 0), 5 * 60_000)
  : 30_000;

type ContextCacheEntry<T> = { value: T; expiresAt: number };
const contextCache = new Map<string, ContextCacheEntry<unknown>>();
const contextLoads = new Map<string, Promise<unknown>>();

const loadCached = async <T>(key: string, loader: () => Promise<T>) => {
  if (!contextCacheTtlMs) return loader();

  const cached = contextCache.get(key) as ContextCacheEntry<T> | undefined;
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const pending = contextLoads.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const load = loader()
    .then((value) => {
      contextCache.set(key, {
        value,
        expiresAt: Date.now() + contextCacheTtlMs,
      });
      return value;
    })
    .finally(() => contextLoads.delete(key));
  contextLoads.set(key, load);
  return load;
};

class ChatbotContextService {
  async loadNLUCatalog(): Promise<NLUCatalog> {
    if (nluCatalogCache && nluCatalogCache.expiresAt > Date.now()) {
      return nluCatalogCache.value;
    }
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

    nluCatalogCache = {
      value,
      expiresAt: Date.now() + 60_000,
    };

    return value;
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

  private async getAvailableSlots(draft: ChatBookingDraft) {
    const today = toDateOnly(new Date());
    const requestedDate =
      draft.date && draft.date >= today ? draft.date : undefined;
    const baseWhere: Prisma.DoctorTimeSlotWhereInput = {
      ...(draft.doctorId ? { doctorId: draft.doctorId } : {}),
      status: "AVAILABLE",
      isActive: true,
      appointment: { is: null },
      doctor: {
        ...(draft.departmentId ? { departmentId: draft.departmentId } : {}),
        isAvailable: true,
        user: {
          isActive: true,
        },
      },
    };

    const select = {
      id: true,
      doctorId: true,
      date: true,
      startTime: true,
      endTime: true,
    } as const;

    const findSlots = (date: Date | { gte: Date }, take = 20) =>
      prisma.doctorTimeSlot.findMany({
        where: {
          ...baseWhere,
          date,
        },
        select,
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        take,
      });

    const slots = requestedDate
      ? await findSlots(parseDateOnly(requestedDate))
      : await findSlots({ gte: parseDateOnly(today) });

    const usableSlots = slots.filter(
      (slot) =>
        !isSlotStartInPastVietnamTime(slot.date, slot.startTime) &&
        matchesTimePeriod(slot.startTime, draft.timePeriod),
    );
    const fallbackSlots =
      requestedDate && !usableSlots.length
        ? (await findSlots({ gte: parseDateOnly(requestedDate) })).filter(
            (slot) =>
              !isSlotStartInPastVietnamTime(slot.date, slot.startTime) &&
              matchesTimePeriod(slot.startTime, draft.timePeriod),
          )
        : usableSlots;

    return fallbackSlots.map((slot) => ({
      id: slot.id,
      doctorId: slot.doctorId,
      date: toDateOnly(slot.date),
      startTime: slot.startTime,
      endTime: slot.endTime,
    }));
  }
}

export default new ChatbotContextService();
