import { Prisma } from "../../generated/prisma/client.js";
import { getNotificationMaxDeliveryAttempts } from "../config/environment.js";
import { prisma } from "../config/prisma.js";
import FcmPushService from "./fcmPush.service.js";
import { isNotificationPushEnabled } from "./notificationPreference.service.js";

const RETRY_BASE_DELAY_MS = 30_000;
const DELIVERY_LEASE_MS = 60_000;

const payloadToStrings = (payload: Prisma.JsonValue) => {
  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(payload).flatMap(([key, value]) =>
      value === null || typeof value === "object"
        ? []
        : [[key, String(value)]],
    ),
  );
};

class NotificationDeliveryService {
  async dispatchNotification(notificationId: string) {
    if (!FcmPushService.isConfigured()) {
      return {
        configured: false,
        sent: 0,
        failed: 0,
        exhausted: 0,
        invalid: 0,
        cancelled: 0,
      };
    }

    const now = new Date();
    const deliveries = await prisma.notificationDelivery.findMany({
      where: {
        notificationId,
        status: { in: ["PENDING", "FAILED"] },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
        notification: {
          publishedAt: { lte: now },
          cancelledAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      },
      include: {
        notification: {
          include: {
            user: {
              select: { notificationPreference: true },
            },
          },
        },
        session: {
          select: {
            id: true,
            pushToken: true,
            revokedAt: true,
            expiresAt: true,
            pushDisabledAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    let sent = 0;
    let failed = 0;
    let exhausted = 0;
    let invalid = 0;
    let cancelled = 0;

    for (const delivery of deliveries) {
      const token = delivery.session.pushToken;
      const pushEnabled = isNotificationPushEnabled(
        delivery.notification.type,
        delivery.notification.user.notificationPreference,
      );
      if (
        !token ||
        !pushEnabled ||
        delivery.session.revokedAt ||
        delivery.session.pushDisabledAt ||
        delivery.session.expiresAt <= now
      ) {
        cancelled += 1;
        await prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "CANCELLED",
            lastError: pushEnabled
              ? "Phiên thiết bị không còn nhận thông báo"
              : "Người dùng đã tắt push cho nhóm thông báo này",
            nextAttemptAt: null,
          },
        });
        continue;
      }

      const claimed = await prisma.notificationDelivery.updateMany({
        where: {
          id: delivery.id,
          status: delivery.status,
          attempts: delivery.attempts,
          OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
        },
        data: {
          attempts: { increment: 1 },
          nextAttemptAt: new Date(now.getTime() + DELIVERY_LEASE_MS),
        },
      });
      if (claimed.count !== 1) continue;

      const result = await FcmPushService.send({
        token,
        title: delivery.notification.title,
        body: delivery.notification.body,
        data: {
          notificationId: delivery.notification.id,
          type: delivery.notification.type,
          ...(delivery.notification.entityType
            ? { entityType: delivery.notification.entityType }
            : {}),
          ...(delivery.notification.entityId
            ? { entityId: delivery.notification.entityId }
            : {}),
          ...payloadToStrings(delivery.notification.payload),
        },
      });

      if (result.outcome === "SENT") {
        sent += 1;
        await prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: {
            status: "SENT",
            providerMessageId: result.providerMessageId,
            lastError: null,
            nextAttemptAt: null,
            sentAt: new Date(),
          },
        });
        continue;
      }

      if (result.outcome === "INVALID_TOKEN") {
        invalid += 1;
        await prisma.$transaction([
          prisma.notificationDelivery.update({
            where: { id: delivery.id },
            data: {
              status: "INVALID_TOKEN",
              lastError: result.error,
              nextAttemptAt: null,
            },
          }),
          prisma.dashboardSession.updateMany({
            where: { id: delivery.session.id, pushToken: token },
            data: {
              pushToken: null,
              pushDisabledAt: new Date(),
            },
          }),
        ]);
        continue;
      }

      if (result.outcome === "FAILED") {
        const attemptsAfterClaim = delivery.attempts + 1;
        const isExhausted =
          attemptsAfterClaim >= getNotificationMaxDeliveryAttempts();
        if (isExhausted) exhausted += 1;
        else failed += 1;
        const retryDelay =
          RETRY_BASE_DELAY_MS * 2 ** Math.min(delivery.attempts, 6);
        await prisma.notificationDelivery.update({
          where: { id: delivery.id },
          data: {
            status: isExhausted ? "EXHAUSTED" : "FAILED",
            lastError: result.error,
            nextAttemptAt: isExhausted
              ? null
              : new Date(Date.now() + retryDelay),
          },
        });
      }
    }

    const remaining = await prisma.notificationDelivery.count({
      where: {
        notificationId,
        status: { in: ["PENDING", "FAILED"] },
      },
    });
    if (remaining === 0 && deliveries.length > 0) {
      await prisma.notification.updateMany({
        where: { id: notificationId, dispatchedAt: null },
        data: { dispatchedAt: new Date() },
      });
    }

    return { configured: true, sent, failed, exhausted, invalid, cancelled };
  }

  async dispatchDue(limit = 100) {
    const now = new Date();
    const published = await prisma.notification.updateMany({
      where: {
        publishedAt: null,
        cancelledAt: null,
        scheduledAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      data: { publishedAt: now },
    });

    const due = await prisma.notificationDelivery.findMany({
      where: {
        status: { in: ["PENDING", "FAILED"] },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
        notification: {
          publishedAt: { lte: now },
          cancelledAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      },
      select: { notificationId: true },
      distinct: ["notificationId"],
      orderBy: { createdAt: "asc" },
      take: Math.max(1, Math.min(limit, 500)),
    });

    const summary = {
      configured: FcmPushService.isConfigured(),
      published: published.count,
      scanned: due.length,
      sent: 0,
      failed: 0,
      exhausted: 0,
      invalid: 0,
      cancelled: 0,
      errors: 0,
    };

    if (!summary.configured) return summary;

    for (const item of due) {
      try {
        const result = await this.dispatchNotification(item.notificationId);
        summary.sent += result.sent;
        summary.failed += result.failed;
        summary.exhausted += result.exhausted;
        summary.invalid += result.invalid;
        summary.cancelled += result.cancelled;
      } catch (error) {
        summary.errors += 1;
        console.error(
          `[NOTIFICATION_WORKER] notification=${item.notificationId} dispatch failed:`,
          error,
        );
      }
    }
    return summary;
  }
}

export default new NotificationDeliveryService();
