import { Prisma } from "../../generated/prisma/client.js";
import type {
  AppointmentStatus,
  InvoiceStatus,
  PaymentMethod,
  Role,
  TimeSlotStatus,
} from "../../generated/prisma/enums.js";
import { prisma } from "../config/prisma.js";
import AppointmentService from "./appointment.service.js";
import DoctorTimeSlotService from "./doctorTimeSlot.service.js";
import MedicalRecordService from "./medicalRecord.service.js";
import PrescriptionService from "./prescription.service.js";

type DateRangeInput = {
  from?: Date;
  to?: Date;
};

type DashboardActor = {
  userId: string;
  role: Role;
};

const toDateOnly = (date: Date) => date.toISOString().slice(0, 10);

const getDefaultRange = () => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const from = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const to = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));

  return { from, to };
};

const normalizeRange = (range: DateRangeInput) => {
  const defaults = getDefaultRange();
  const from = range.from || defaults.from;
  const to = range.to || defaults.to;

  return from <= to ? { from, to } : { from: to, to: from };
};

const buildDateTimeRange = ({
  from,
  to,
}: ReturnType<typeof normalizeRange>) => ({
  gte: from,
  lte: to,
});

const sumAmount = (value: number | null | undefined) => value || 0;

const getDateKeys = (range: ReturnType<typeof normalizeRange>) => {
  const dates: string[] = [];
  const cursor = new Date(
    Date.UTC(
      range.from.getUTCFullYear(),
      range.from.getUTCMonth(),
      range.from.getUTCDate(),
    ),
  );
  const end = new Date(
    Date.UTC(
      range.to.getUTCFullYear(),
      range.to.getUTCMonth(),
      range.to.getUTCDate(),
    ),
  );

  while (cursor <= end) {
    dates.push(toDateOnly(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
};

const countBy = <T extends string | null>(
  groups: { key: T; count: number }[],
  values: readonly string[],
) =>
  values.map((value) => ({
    value,
    count: groups.find((group) => group.key === value)?.count || 0,
  }));

const normalizeNullableKey = (value: string | null) => value || "unknown";

class DashboardStatisticsService {
  async getDoctorWorkspace(date: string, actor: DashboardActor) {
    const [
      todayAppointments,
      checkedInAppointments,
      inProgressAppointments,
      draftRecords,
      draftPrescriptions,
      todaySlots,
    ] = await Promise.all([
      AppointmentService.dashboardList({ date, limit: 100 }, actor),
      AppointmentService.dashboardList(
        { status: "CHECKED_IN", limit: 20 },
        actor,
      ),
      AppointmentService.dashboardList(
        { status: "IN_PROGRESS", limit: 20 },
        actor,
      ),
      MedicalRecordService.list({ status: "DRAFT", limit: 20 }, actor),
      PrescriptionService.list({ status: "DRAFT", limit: 20 }, actor),
      DoctorTimeSlotService.list({ date, limit: 200 }, actor),
    ]);

    return {
      todayAppointments: todayAppointments.items,
      checkedInAppointments: checkedInAppointments.items,
      inProgressAppointments: inProgressAppointments.items,
      draftRecords: draftRecords.items,
      draftPrescriptions: draftPrescriptions.items,
      todaySlots: todaySlots.items,
    };
  }

  async getWorkspace(input: DateRangeInput) {
    const [overview, appointments, revenue, doctors, departments] =
      await Promise.all([
        this.getOverview(input),
        this.getAppointments(input),
        this.getRevenue(input),
        this.getDoctors(input),
        this.getDepartments(input),
      ]);

    return { overview, appointments, revenue, doctors, departments };
  }

  async getOverview(input: DateRangeInput) {
    const range = normalizeRange(input);
    const appointmentDate = buildDateTimeRange(range);
    const createdAt = buildDateTimeRange(range);
    const today = new Date();
    const todayStart = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    const todayEnd = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );

    const [
      totalAppointments,
      pendingConfirmAppointments,
      todayAppointments,
      completedAppointments,
      cancelledAppointments,
      newPatients,
      unpaidInvoices,
      consultationRequests,
      pendingConsultationRequests,
      completedWithoutInvoiceAppointments,
      paidInvoiceAggregate,
      refundedInvoiceAggregate,
      latestAppointments,
      totalSearches,
      emptySearches,
      topSearchKeywords,
      topEmptySearchKeywords,
      searchTypeGroups,
      searchSourceGroups,
    ] = await prisma.$transaction([
      prisma.appointment.count({ where: { appointmentDate } }),
      prisma.appointment.count({
        where: { appointmentDate, status: "PENDING_CONFIRM" },
      }),
      prisma.appointment.count({
        where: {
          appointmentDate: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
      }),
      prisma.appointment.count({
        where: { appointmentDate, status: "COMPLETED" },
      }),
      prisma.appointment.count({
        where: {
          appointmentDate,
          status: {
            in: [
              "CANCELLED_BY_ADMIN",
              "CANCELLED_BY_DOCTOR",
              "CANCELLED_BY_PATIENT",
              "NO_SHOW",
            ],
          },
        },
      }),
      prisma.user.count({
        where: {
          role: "PATIENT",
          createdAt,
        },
      }),
      prisma.invoice.count({ where: { createdAt, status: "UNPAID" } }),
      prisma.consultationRequest.count({ where: { createdAt } }),
      prisma.consultationRequest.count({
        where: {
          status: {
            in: ["NEW", "CONTACTED"],
          },
        },
      }),
      prisma.appointment.count({
        where: {
          appointmentDate,
          status: "COMPLETED",
          invoice: null,
        },
      }),
      prisma.invoice.aggregate({
        where: { createdAt, status: { in: ["PAID", "REFUNDED"] } },
        _sum: { finalAmount: true },
      }),
      prisma.invoice.aggregate({
        where: { createdAt, status: "REFUNDED" },
        _sum: { finalAmount: true },
      }),
      prisma.appointment.findMany({
        where: { appointmentDate },
        select: {
          id: true,
          bookingCode: true,
          appointmentDate: true,
          startTime: true,
          endTime: true,
          status: true,
          patientName: true,
          patientPhone: true,
          doctor: {
            select: {
              title: true,
              user: { select: { fullName: true } },
            },
          },
          department: {
            select: {
              name: true,
            },
          },
        },
        orderBy: [{ appointmentDate: "desc" }, { startTime: "asc" }],
        take: 5,
      }),
      prisma.searchAnalyticsLog.count({ where: { createdAt } }),
      prisma.searchAnalyticsLog.count({
        where: { createdAt, hasResults: false },
      }),
      prisma.searchAnalyticsLog.groupBy({
        by: ["normalized", "keyword"],
        where: { createdAt },
        _count: { _all: true },
        orderBy: { _count: { normalized: "desc" } },
        take: 8,
      }),
      prisma.searchAnalyticsLog.groupBy({
        by: ["normalized", "keyword"],
        where: { createdAt, hasResults: false },
        _count: { _all: true },
        orderBy: { _count: { normalized: "desc" } },
        take: 8,
      }),
      prisma.searchAnalyticsLog.groupBy({
        by: ["type"],
        where: { createdAt },
        _count: { _all: true },
        orderBy: { _count: { type: "desc" } },
      }),
      prisma.searchAnalyticsLog.groupBy({
        by: ["source"],
        where: { createdAt },
        _count: { _all: true },
        orderBy: { _count: { source: "desc" } },
      }),
    ]);

    const collectedAmount = sumAmount(paidInvoiceAggregate._sum.finalAmount);
    const refundedAmount = sumAmount(refundedInvoiceAggregate._sum.finalAmount);

    return {
      range,
      metrics: {
        totalAppointments,
        pendingConfirmAppointments,
        todayAppointments,
        completedAppointments,
        cancelledAppointments,
        newPatients,
        unpaidInvoices,
        consultationRequests,
        pendingConsultationRequests,
        completedWithoutInvoiceAppointments,
        collectedAmount,
        refundedAmount,
        netAmount: collectedAmount - refundedAmount,
      },
      searchAnalytics: {
        metrics: {
          totalSearches,
          emptySearches,
          successRate: totalSearches
            ? Math.round(
                ((totalSearches - emptySearches) / totalSearches) * 100,
              )
            : 0,
        },
        topKeywords: topSearchKeywords.map((item) => ({
          keyword: item.keyword,
          normalized: item.normalized,
          count: item._count._all,
        })),
        emptyKeywords: topEmptySearchKeywords.map((item) => ({
          keyword: item.keyword,
          normalized: item.normalized,
          count: item._count._all,
        })),
        byType: searchTypeGroups.map((item) => ({
          type: item.type,
          count: item._count._all,
        })),
        bySource: searchSourceGroups.map((item) => ({
          source: normalizeNullableKey(item.source),
          count: item._count._all,
        })),
      },
      latestAppointments,
    };
  }

  async getAppointments(input: DateRangeInput) {
    const range = normalizeRange(input);
    const appointmentDate = buildDateTimeRange(range);
    const statuses = [
      "PENDING_OTP",
      "PENDING_CONFIRM",
      "CONFIRMED",
      "CHECKED_IN",
      "IN_PROGRESS",
      "COMPLETED",
      "RESCHEDULED",
      "CANCELLED_BY_PATIENT",
      "CANCELLED_BY_DOCTOR",
      "CANCELLED_BY_ADMIN",
      "NO_SHOW",
    ] as const satisfies readonly AppointmentStatus[];

    const [total, statusGroups, appointments] = await prisma.$transaction([
      prisma.appointment.count({ where: { appointmentDate } }),
      prisma.appointment.groupBy({
        by: ["status"],
        where: { appointmentDate },
        _count: { status: true },
      }),
      prisma.appointment.findMany({
        where: { appointmentDate },
        select: {
          appointmentDate: true,
          status: true,
          finalAmount: true,
        },
        orderBy: { appointmentDate: "asc" },
      }),
    ]);

    const dailyMap = new Map<
      string,
      { total: number; completed: number; cancelled: number }
    >();
    for (const date of getDateKeys(range)) {
      dailyMap.set(date, { total: 0, completed: 0, cancelled: 0 });
    }

    for (const appointment of appointments) {
      const key = toDateOnly(appointment.appointmentDate);
      const item = dailyMap.get(key) || {
        total: 0,
        completed: 0,
        cancelled: 0,
      };
      item.total += 1;
      if (appointment.status === "COMPLETED") item.completed += 1;
      if (
        [
          "CANCELLED_BY_PATIENT",
          "CANCELLED_BY_DOCTOR",
          "CANCELLED_BY_ADMIN",
          "NO_SHOW",
        ].includes(appointment.status)
      ) {
        item.cancelled += 1;
      }
      dailyMap.set(key, item);
    }

    return {
      range,
      metrics: {
        total,
      },
      byStatus: countBy(
        statusGroups.map((group) => ({
          key: group.status,
          count: group._count.status,
        })),
        statuses,
      ),
      daily: Array.from(dailyMap.entries()).map(([date, item]) => ({
        date,
        ...item,
      })),
    };
  }

  async getRevenue(input: DateRangeInput) {
    const range = normalizeRange(input);
    const createdAt = buildDateTimeRange(range);
    const statuses = [
      "UNPAID",
      "PAID",
      "CANCELLED",
      "REFUNDED",
    ] as const satisfies readonly InvoiceStatus[];
    const paymentMethods = [
      "CASH",
      "CARD",
      "BANK_TRANSFER",
      "MOMO",
      "VNPAY",
      "OTHER",
    ] as const satisfies readonly PaymentMethod[];

    const [statusGroups, methodGroups, invoices] = await prisma.$transaction([
      prisma.invoice.groupBy({
        by: ["status"],
        where: { createdAt },
        _count: { status: true },
        _sum: { finalAmount: true },
      }),
      prisma.invoice.groupBy({
        by: ["paymentMethod"],
        where: {
          createdAt,
          paymentMethod: { not: null },
          status: { in: ["PAID", "REFUNDED"] },
        },
        _count: { paymentMethod: true },
        _sum: { finalAmount: true },
      }),
      prisma.invoice.findMany({
        where: { createdAt },
        select: {
          createdAt: true,
          status: true,
          finalAmount: true,
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const collectedAmount = invoices
      .filter(
        (invoice) => invoice.status === "PAID" || invoice.status === "REFUNDED",
      )
      .reduce((total, invoice) => total + invoice.finalAmount, 0);
    const refundedAmount = invoices
      .filter((invoice) => invoice.status === "REFUNDED")
      .reduce((total, invoice) => total + invoice.finalAmount, 0);

    const dailyMap = new Map<
      string,
      { collectedAmount: number; refundedAmount: number; netAmount: number }
    >();
    for (const date of getDateKeys(range)) {
      dailyMap.set(date, {
        collectedAmount: 0,
        refundedAmount: 0,
        netAmount: 0,
      });
    }

    for (const invoice of invoices) {
      const key = toDateOnly(invoice.createdAt);
      const item = dailyMap.get(key) || {
        collectedAmount: 0,
        refundedAmount: 0,
        netAmount: 0,
      };
      if (invoice.status === "PAID" || invoice.status === "REFUNDED") {
        item.collectedAmount += invoice.finalAmount;
        item.netAmount += invoice.finalAmount;
      }
      if (invoice.status === "REFUNDED") {
        item.refundedAmount += invoice.finalAmount;
        item.netAmount -= invoice.finalAmount;
      }
      dailyMap.set(key, item);
    }

    return {
      range,
      metrics: {
        collectedAmount,
        refundedAmount,
        netAmount: collectedAmount - refundedAmount,
        invoiceCount: invoices.length,
      },
      byStatus: statuses.map((status) => {
        const group = statusGroups.find((item) => item.status === status);
        return {
          status,
          count: group?._count.status || 0,
          amount: sumAmount(group?._sum.finalAmount),
        };
      }),
      byPaymentMethod: paymentMethods.map((paymentMethod) => {
        const group = methodGroups.find(
          (item) => item.paymentMethod === paymentMethod,
        );
        return {
          paymentMethod,
          count: group?._count.paymentMethod || 0,
          amount: sumAmount(group?._sum.finalAmount),
        };
      }),
      daily: Array.from(dailyMap.entries()).map(([date, item]) => ({
        date,
        ...item,
      })),
    };
  }

  async getDoctors(input: DateRangeInput) {
    const range = normalizeRange(input);
    const appointmentDate = buildDateTimeRange(range);
    const date = buildDateTimeRange(range);
    const slotStatuses = [
      "AVAILABLE",
      "BOOKED",
      "LOCKED",
      "CANCELLED",
    ] as const satisfies readonly TimeSlotStatus[];

    const [appointmentGroups, slotGroups] = await prisma.$transaction([
      prisma.appointment.groupBy({
        by: ["doctorId"],
        where: { appointmentDate },
        _count: { doctorId: true },
        orderBy: { _count: { doctorId: "desc" } },
        take: 10,
      }),
      prisma.doctorTimeSlot.groupBy({
        by: ["doctorId", "status"],
        where: { date },
        _count: { status: true },
      }),
    ]);

    const doctorIds = Array.from(
      new Set([
        ...appointmentGroups.map((group) => group.doctorId),
        ...slotGroups.map((group) => group.doctorId),
      ]),
    );
    const doctors = doctorIds.length
      ? await prisma.doctorProfile.findMany({
          where: { id: { in: doctorIds } },
          select: {
            id: true,
            title: true,
            specialization: true,
            user: { select: { fullName: true, avatar: true } },
            department: { select: { id: true, name: true, slug: true } },
          },
        })
      : [];

    return {
      range,
      items: doctors
        .map((doctor) => {
          const appointmentGroup = appointmentGroups.find(
            (group) => group.doctorId === doctor.id,
          );
          return {
            doctor,
            appointmentCount: appointmentGroup?._count.doctorId || 0,
            slots: slotStatuses.map((status) => {
              const group = slotGroups.find(
                (item) => item.doctorId === doctor.id && item.status === status,
              );
              return {
                status,
                count: group?._count.status || 0,
              };
            }),
          };
        })
        .sort((a, b) => b.appointmentCount - a.appointmentCount),
    };
  }

  async getDepartments(input: DateRangeInput) {
    const range = normalizeRange(input);
    const appointmentDate = buildDateTimeRange(range);

    const [appointmentGroups, departments] = await prisma.$transaction([
      prisma.appointment.groupBy({
        by: ["departmentId"],
        where: { appointmentDate },
        _count: { departmentId: true },
        _sum: { finalAmount: true },
        orderBy: { _count: { departmentId: "desc" } },
        take: 10,
      }),
      prisma.department.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          _count: {
            select: {
              doctors: true,
              packages: true,
            },
          },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    return {
      range,
      items: appointmentGroups.map((group) => {
        const department = departments.find(
          (item) => item.id === group.departmentId,
        );
        return {
          department,
          appointmentCount: group._count.departmentId,
          estimatedAmount: sumAmount(group._sum.finalAmount),
        };
      }),
      activeDepartments: departments.filter((department) => department.isActive)
        .length,
      totalDepartments: departments.length,
    };
  }
}

export default new DashboardStatisticsService();
