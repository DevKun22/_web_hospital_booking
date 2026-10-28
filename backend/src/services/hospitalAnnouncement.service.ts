import { randomUUID } from "node:crypto";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import NotificationDeliveryService from "./notificationDelivery.service.js";

const DISPATCH_CONCURRENCY = 10;
const UPCOMING_APPOINTMENT_STATUSES = [
  "PENDING_CONFIRM",
  "CONFIRMED",
  "CHECKED_IN",
] as const;

export type HospitalAnnouncementAudience =
  | "ALL_PATIENTS"
  | "UPCOMING_APPOINTMENTS"
  | "DEPARTMENT_APPOINTMENTS";

export type CreateHospitalAnnouncementInput = {
  createdById: string;
  title: string;
  body: string;
  scheduledAt?: Date;
  expiresAt?: Date;
  audience: HospitalAnnouncementAudience;
  departmentId?: string | null;
};

const startOfToday = (value = new Date()) =>
  new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );

const readAudiencePayload = (payload: Prisma.JsonValue) => {
  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return { audience: "ALL_PATIENTS" as HospitalAnnouncementAudience };
  }
  const rawAudience = payload.audience;
  const audience: HospitalAnnouncementAudience =
    rawAudience === "UPCOMING_APPOINTMENTS" ||
    rawAudience === "DEPARTMENT_APPOINTMENTS"
      ? rawAudience
      : "ALL_PATIENTS";
  return {
    audience,
    departmentId:
      typeof payload.departmentId === "string" ? payload.departmentId : null,
    departmentName:
      typeof payload.departmentName === "string" ? payload.departmentName : null,
  };
};

class HospitalAnnouncementService {
  async create(input: CreateHospitalAnnouncementInput) {
    const now = new Date();
    const scheduledAt = input.scheduledAt ?? now;
    if (input.expiresAt && input.expiresAt <= scheduledAt) {
      throw new AppError(
        "Thời gian hết hạn phải sau thời gian gửi",
        400,
        "INVALID_ANNOUNCEMENT_EXPIRY",
      );
    }

    let department: { id: string; name: string } | null = null;
    if (input.audience === "DEPARTMENT_APPOINTMENTS") {
      department = await prisma.department.findFirst({
        where: { id: input.departmentId ?? "", isActive: true },
        select: { id: true, name: true },
      });
      if (!department) {
        throw new AppError(
          "Không tìm thấy chuyên khoa đang hoạt động",
          404,
          "ANNOUNCEMENT_DEPARTMENT_NOT_FOUND",
        );
      }
    }

    const appointmentAudience =
      input.audience === "ALL_PATIENTS"
        ? undefined
        : {
            some: {
              appointmentDate: { gte: startOfToday(now) },
              status: { in: [...UPCOMING_APPOINTMENT_STATUSES] },
              ...(department ? { departmentId: department.id } : {}),
            },
          };
    const patients = await prisma.user.findMany({
      where: {
        role: "PATIENT",
        isActive: true,
        ...(appointmentAudience ? { appointments: appointmentAudience } : {}),
      },
      select: { id: true },
    });
    if (patients.length === 0) {
      throw new AppError(
        "Chưa có bệnh nhân đang hoạt động để nhận thông báo",
        409,
        "NO_ANNOUNCEMENT_RECIPIENTS",
      );
    }

    const campaignId = randomUUID();
    const publishedAt = scheduledAt <= now ? now : null;
    const notifications = patients.map((patient) => ({
      id: randomUUID(),
      userId: patient.id,
      type: "SYSTEM_ANNOUNCEMENT" as const,
      title: input.title.trim(),
      body: input.body.trim(),
      campaignId,
      createdById: input.createdById,
      scheduledAt,
      publishedAt,
      expiresAt: input.expiresAt,
      dedupeKey: `announcement:${campaignId}:${patient.id}`,
      payload: {
        campaignId,
        audience: input.audience,
        ...(department
          ? { departmentId: department.id, departmentName: department.name }
          : {}),
      },
    }));
    const notificationIdByUser = new Map(
      notifications.map((item) => [item.userId, item.id]),
    );

    const deliveryCount = await prisma.$transaction(async (tx) => {
      await tx.notification.createMany({ data: notifications });
      const sessions = await tx.dashboardSession.findMany({
        where: {
          userId: { in: patients.map((patient) => patient.id) },
          kind: "PATIENT",
          revokedAt: null,
          expiresAt: { gt: now },
          pushToken: { not: null },
          pushDisabledAt: null,
        },
        select: { id: true, userId: true },
      });
      if (sessions.length === 0) return 0;

      const deliveries = sessions.flatMap((session) => {
        const notificationId = notificationIdByUser.get(session.userId);
        return notificationId
          ? [{ notificationId, sessionId: session.id }]
          : [];
      });
      if (deliveries.length > 0) {
        await tx.notificationDelivery.createMany({
          data: deliveries,
          skipDuplicates: true,
        });
      }
      return deliveries.length;
    });

    if (publishedAt && deliveryCount > 0) {
      void this.dispatchBestEffort(notifications.map((item) => item.id));
    }

    return {
      campaignId,
      title: input.title.trim(),
      body: input.body.trim(),
      audience: input.audience,
      department,
      recipientCount: patients.length,
      deliveryCount,
      scheduledAt,
      publishedAt,
      expiresAt: input.expiresAt ?? null,
    };
  }

  async listRecent(limit = 20) {
    const representatives = await prisma.notification.findMany({
      where: {
        type: "SYSTEM_ANNOUNCEMENT",
        campaignId: { not: null },
      },
      select: {
        campaignId: true,
        createdById: true,
        title: true,
        body: true,
        scheduledAt: true,
        publishedAt: true,
        cancelledAt: true,
        expiresAt: true,
        payload: true,
        createdAt: true,
      },
      distinct: ["campaignId"],
      orderBy: { createdAt: "desc" },
      take: Math.max(1, Math.min(limit, 50)),
    });

    const creatorIds = [
      ...new Set(
        representatives.flatMap((item) =>
          item.createdById ? [item.createdById] : [],
        ),
      ),
    ];
    const creators = await prisma.user.findMany({
      where: { id: { in: creatorIds } },
      select: { id: true, fullName: true },
    });
    const creatorById = new Map(creators.map((item) => [item.id, item]));

    return Promise.all(
      representatives.map(async (item) => {
        const campaignId = item.campaignId!;
        const [recipientCount, deliveryGroups] = await Promise.all([
          prisma.notification.count({ where: { campaignId } }),
          prisma.notificationDelivery.groupBy({
            by: ["status"],
            where: { notification: { campaignId } },
            _count: { _all: true },
          }),
        ]);
        const deliverySummary = Object.fromEntries(
          deliveryGroups.map((group) => [group.status, group._count._all]),
        );
        const audiencePayload = readAudiencePayload(item.payload);
        return {
          ...item,
          campaignId,
          ...audiencePayload,
          recipientCount,
          deliverySummary,
          createdBy: item.createdById
            ? (creatorById.get(item.createdById) ?? null)
            : null,
        };
      }),
    );
  }

  async cancelScheduled(campaignId: string) {
    const now = new Date();
    const campaign = await prisma.notification.findFirst({
      where: { campaignId, type: "SYSTEM_ANNOUNCEMENT" },
      select: { publishedAt: true, cancelledAt: true },
    });
    if (!campaign) {
      throw new AppError(
        "Không tìm thấy chiến dịch thông báo",
        404,
        "ANNOUNCEMENT_NOT_FOUND",
      );
    }
    if (campaign.publishedAt) {
      throw new AppError(
        "Thông báo đã phát hành nên không thể hủy",
        409,
        "ANNOUNCEMENT_ALREADY_PUBLISHED",
      );
    }
    if (campaign.cancelledAt) return { campaignId, cancelledAt: campaign.cancelledAt };

    await prisma.$transaction([
      prisma.notification.updateMany({
        where: { campaignId, publishedAt: null, cancelledAt: null },
        data: { cancelledAt: now },
      }),
      prisma.notificationDelivery.updateMany({
        where: { notification: { campaignId }, status: "PENDING" },
        data: { status: "CANCELLED", nextAttemptAt: null },
      }),
    ]);
    return { campaignId, cancelledAt: now };
  }

  private async dispatchBestEffort(notificationIds: string[]) {
    for (let index = 0; index < notificationIds.length; index += DISPATCH_CONCURRENCY) {
      const batch = notificationIds.slice(index, index + DISPATCH_CONCURRENCY);
      await Promise.allSettled(
        batch.map((notificationId) =>
          NotificationDeliveryService.dispatchNotification(notificationId),
        ),
      );
    }
  }
}

export default new HospitalAnnouncementService();
