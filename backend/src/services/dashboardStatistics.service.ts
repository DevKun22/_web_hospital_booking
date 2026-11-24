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


// Lịch không diễn ra: các kiểu hủy và người khám không đến.
const CANCELLED_STATUSES: readonly AppointmentStatus[] = [
  "CANCELLED_BY_PATIENT",
  "CANCELLED_BY_DOCTOR",
  "CANCELLED_BY_ADMIN",
  "NO_SHOW",
];

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

    // Đếm lịch và hóa đơn theo trạng thái bằng một câu groupBy mỗi loại, thay vì một câu đếm cho từng trạng thái.
    const [
      appointmentStatusGroups,
      invoiceStatusGroups,
      todayAppointments,
      newPatients,
      completedWithoutInvoiceAppointments,
      latestAppointments,
    ] = await prisma.$transaction([
      prisma.appointment.groupBy({
        by: ["status"],
        where: { appointmentDate },
        _count: { _all: true },
        orderBy: { status: "asc" },
      }),
      prisma.invoice.groupBy({
        by: ["status"],
        where: { createdAt },
        _count: { _all: true },
        _sum: { finalAmount: true },
        orderBy: { status: "asc" },
      }),
      prisma.appointment.count({
        where: {
          appointmentDate: {
            gte: todayStart,
            lte: todayEnd,
          },
        },
      }),
      prisma.user.count({
        where: {
          role: "PATIENT",
          createdAt,
        },
      }),
      prisma.appointment.count({
        where: {
          appointmentDate,
          status: "COMPLETED",
          invoice: null,
        },
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
    ]);

    const appointmentsWith = (statuses: readonly AppointmentStatus[]) =>
      appointmentStatusGroups
        .filter((group) => statuses.includes(group.status))
        .reduce((total, group) => total + group._count._all, 0);
    const invoiceGroup = (status: InvoiceStatus) =>
      invoiceStatusGroups.find((group) => group.status === status);
    const paidAmount = sumAmount(invoiceGroup("PAID")?._sum?.finalAmount);
    const refundedAmount = sumAmount(invoiceGroup("REFUNDED")?._sum?.finalAmount);
    // Tiền đã thu gồm cả hóa đơn đã hoàn (thu rồi mới hoàn); tiền ròng trừ phần hoàn.
    const collectedAmount = paidAmount + refundedAmount;
    const unpaidInvoices = (invoiceGroup("UNPAID")?._count._all ?? 0);

    return {
      range,
      metrics: {
        totalAppointments: appointmentStatusGroups.reduce(
          (total, group) => total + group._count._all,
          0,
        ),
        pendingConfirmAppointments: appointmentsWith(["PENDING_CONFIRM"]),
        todayAppointments,
        completedAppointments: appointmentsWith(["COMPLETED"]),
        cancelledAppointments: appointmentsWith(CANCELLED_STATUSES),
        newPatients,
        unpaidInvoices,
        completedWithoutInvoiceAppointments,
        collectedAmount,
        refundedAmount,
        netAmount: collectedAmount - refundedAmount,
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

    // Gom theo (ngày, trạng thái) ngay trong cơ sở dữ liệu: tối đa số ngày x 11 dòng, thay vì kéo từng lịch hẹn trong khoảng về cộng lại.
    const [total, statusGroups, dailyGroups] = await prisma.$transaction([
      prisma.appointment.count({ where: { appointmentDate } }),
      prisma.appointment.groupBy({
        by: ["status"],
        where: { appointmentDate },
        _count: { status: true },
      }),
      prisma.appointment.groupBy({
        by: ["appointmentDate", "status"],
        where: { appointmentDate },
        _count: { _all: true },
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

    for (const group of dailyGroups) {
      const key = toDateOnly(group.appointmentDate);
      const item = dailyMap.get(key) || { total: 0, completed: 0, cancelled: 0 };
      item.total += group._count._all;
      if (group.status === "COMPLETED") item.completed += group._count._all;
      if (CANCELLED_STATUSES.includes(group.status)) item.cancelled += group._count._all;
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
      // Chỉ hóa đơn đã thu (kể cả đã hoàn) mới góp vào doanh thu theo ngày; hóa đơn chưa thu, đã hủy không cần kéo về.
      prisma.invoice.findMany({
        where: { createdAt, status: { in: ["PAID", "REFUNDED"] } },
        select: {
          createdAt: true,
          status: true,
          finalAmount: true,
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // Tổng tiền lấy từ nhóm theo trạng thái (đã cộng trong cơ sở dữ liệu), không cộng lại từng hóa đơn.
    const amountOf = (status: InvoiceStatus) =>
      sumAmount(statusGroups.find((group) => group.status === status)?._sum.finalAmount);
    const refundedAmount = amountOf("REFUNDED");
    const collectedAmount = amountOf("PAID") + refundedAmount;

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
        invoiceCount: statusGroups.reduce(
          (total, group) => total + group._count.status,
          0,
        ),
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
