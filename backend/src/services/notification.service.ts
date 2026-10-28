import { Prisma } from "../../generated/prisma/client.js";
import type { NotificationType } from "../../generated/prisma/enums.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../utils/appError.js";
import { paginationMeta } from "../utils/pagination.js";

type DatabaseClient = Prisma.TransactionClient | typeof prisma;

type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  payload?: Prisma.InputJsonValue;
  dedupeKey?: string;
  scheduledAt?: Date;
  publishedAt?: Date | null;
  expiresAt?: Date;
  campaignId?: string;
  createdById?: string;
};

const notificationSelect = {
  id: true,
  type: true,
  title: true,
  body: true,
  entityType: true,
  entityId: true,
  publishedAt: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

const visibleNotificationWhere = (
  userId: string,
  now = new Date(),
): Prisma.NotificationWhereInput => ({
  userId,
  publishedAt: { lte: now },
  cancelledAt: null,
  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
});

const toInboxItem = <T extends { readAt: Date | null }>(item: T) => ({
  ...item,
  isRead: item.readAt !== null,
});

class NotificationService {
  async cleanupExpiredAndRead(retentionDays: number, now = new Date()) {
    const readBefore = new Date(
      now.getTime() - Math.max(1, retentionDays) * 24 * 60 * 60 * 1000,
    );
    const result = await prisma.notification.deleteMany({
      where: {
        OR: [
          { expiresAt: { lte: now } },
          { readAt: { lte: readBefore } },
          { cancelledAt: { lte: readBefore } },
        ],
      },
    });
    return { deletedCount: result.count, readBefore };
  }

  async create(
    input: CreateNotificationInput,
    client: DatabaseClient = prisma,
  ) {
    const now = new Date();
    const scheduledAt = input.scheduledAt ?? now;
    const createData: Prisma.NotificationCreateInput = {
      user: { connect: { id: input.userId } },
      type: input.type,
      title: input.title.trim(),
      body: input.body.trim(),
      entityType: input.entityType?.trim() || null,
      entityId: input.entityId?.trim() || null,
      dedupeKey: input.dedupeKey?.trim() || null,
      scheduledAt,
      publishedAt:
        input.publishedAt === undefined
          ? scheduledAt <= now
            ? now
            : null
          : input.publishedAt,
      expiresAt: input.expiresAt,
      campaignId: input.campaignId?.trim() || null,
      createdById: input.createdById?.trim() || null,
      ...(input.payload === undefined ? {} : { payload: input.payload }),
    };

    if (!createData.title || !createData.body) {
      throw new AppError(
        "Tiêu đề và nội dung thông báo không được để trống",
        400,
        "INVALID_NOTIFICATION_CONTENT",
      );
    }

    if (!createData.dedupeKey) {
      const notification = await client.notification.create({
        data: createData,
        select: notificationSelect,
      });
      await this.createPendingDeliveries(
        client,
        notification.id,
        input.userId,
        now,
      );
      return notification;
    }

    const notification = await client.notification.upsert({
      where: { dedupeKey: createData.dedupeKey },
      update: {},
      create: createData,
      select: { ...notificationSelect, userId: true },
    });

    if (notification.userId !== input.userId) {
      throw new AppError(
        "Khóa chống trùng thông báo đã được sử dụng",
        409,
        "NOTIFICATION_DEDUPE_CONFLICT",
      );
    }

    await this.createPendingDeliveries(
      client,
      notification.id,
      input.userId,
      now,
    );

    const { userId: _userId, ...result } = notification;
    return result;
  }

  private async createPendingDeliveries(
    client: DatabaseClient,
    notificationId: string,
    userId: string,
    now: Date,
  ) {
    const sessions = await client.dashboardSession.findMany({
      where: {
        userId,
        kind: "PATIENT",
        revokedAt: null,
        expiresAt: { gt: now },
        pushToken: { not: null },
        pushDisabledAt: null,
      },
      select: { id: true },
    });
    if (sessions.length === 0) return;

    await client.notificationDelivery.createMany({
      data: sessions.map((session) => ({
        notificationId,
        sessionId: session.id,
      })),
      skipDuplicates: true,
    });
  }

  async listForPatient(input: {
    userId: string;
    page: number;
    limit: number;
    unreadOnly?: boolean;
  }) {
    const where: Prisma.NotificationWhereInput = {
      ...visibleNotificationWhere(input.userId),
      ...(input.unreadOnly ? { readAt: null } : {}),
    };
    const [items, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        select: notificationSelect,
        orderBy: [
          { publishedAt: "desc" },
          { createdAt: "desc" },
          { id: "desc" },
        ],
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: {
          ...visibleNotificationWhere(input.userId),
          readAt: null,
        },
      }),
    ]);

    return {
      items: items.map(toInboxItem),
      meta: {
        ...paginationMeta(input.page, input.limit, total),
        unreadCount,
      },
    };
  }

  async unreadCount(userId: string) {
    return prisma.notification.count({
      where: {
        ...visibleNotificationWhere(userId),
        readAt: null,
      },
    });
  }

  async markRead(userId: string, notificationId: string) {
    const item = await prisma.notification.findFirst({
      where: {
        ...visibleNotificationWhere(userId),
        id: notificationId,
      },
      select: notificationSelect,
    });

    if (!item) {
      throw new AppError(
        "Không tìm thấy thông báo",
        404,
        "NOTIFICATION_NOT_FOUND",
      );
    }

    if (item.readAt) return toInboxItem(item);

    const updated = await prisma.notification.update({
      where: { id: item.id },
      data: { readAt: new Date() },
      select: notificationSelect,
    });
    return toInboxItem(updated);
  }

  async markAllRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: {
        ...visibleNotificationWhere(userId),
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    return { updatedCount: result.count, unreadCount: 0 };
  }
}

export default new NotificationService();
