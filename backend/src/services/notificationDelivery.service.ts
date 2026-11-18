import { Prisma } from "../../generated/prisma/client.js";
import { getNotificationMaxDeliveryAttempts } from "../config/environment.js";
import { prisma } from "../config/prisma.js";
import FcmPushService from "./fcmPush.service.js";
import { isNotificationPushEnabled } from "./notificationPreference.service.js";

const RETRY_BASE_DELAY_MS = 30_000;
const DELIVERY_LEASE_MS = 60_000;
// Dòng chuyển phát đã có kết quả cuối chỉ giữ ít ngày cho điều tra; hộp thư (Notification) giữ lâu hơn nhiều.
const FINISHED_DELIVERY_RETENTION_DAYS = 14;

const payloadToStrings = (payload: Prisma.JsonValue) => {
  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(payload).flatMap(([key, value]) =>
      value === null || typeof value === "object" ? [] : [[key, String(value)]],
    ),
  );
};

const deliveryInclude = {
  notification: {
    include: { user: { select: { notificationPreference: true } } },
  },
  session: {
    select: { id: true, pushToken: true, revokedAt: true, expiresAt: true, pushDisabledAt: true },
  },
} satisfies Prisma.NotificationDeliveryInclude;

type DueDelivery = Prisma.NotificationDeliveryGetPayload<{ include: typeof deliveryInclude }>;

const emptySummary = () => ({ sent: 0, failed: 0, exhausted: 0, invalid: 0, cancelled: 0 });

class NotificationDeliveryService {
  // Xử lý một nhóm dòng chuyển phát (có thể thuộc nhiều thông báo): hủy dòng không còn hợp lệ, giành quyền gửi bằng cập
  // nhật có điều kiện, gửi FCM theo lô (tối đa 500 tin mỗi lệnh gọi) rồi ghi kết quả từng dòng.
  private async processDeliveries(deliveries: DueDelivery[], now: Date) {
    const summary = emptySummary();
    const toSend: { delivery: DueDelivery; token: string }[] = [];

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
        summary.cancelled += 1;
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
      if (claimed.count === 1) toSend.push({ delivery, token });
    }

    if (toSend.length === 0) return summary;

    const results = await FcmPushService.sendBatch(
      toSend.map(({ delivery, token }) => ({
        token,
        title: delivery.notification.title,
        body: delivery.notification.body,
        data: {
          notificationId: delivery.notification.id,
          type: delivery.notification.type,
          ...(delivery.notification.entityType ? { entityType: delivery.notification.entityType } : {}),
          ...(delivery.notification.entityId ? { entityId: delivery.notification.entityId } : {}),
          ...payloadToStrings(delivery.notification.payload),
        },
      })),
    );

    for (const [index, { delivery, token }] of toSend.entries()) {
      const result = results[index] ?? { outcome: "FAILED" as const, error: "Thiếu kết quả gửi FCM" };

      if (result.outcome === "SENT") {
        summary.sent += 1;
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
        summary.invalid += 1;
        await prisma.$transaction([
          prisma.notificationDelivery.update({
            where: { id: delivery.id },
            data: { status: "INVALID_TOKEN", lastError: result.error, nextAttemptAt: null },
          }),
          prisma.authSession.updateMany({
            where: { id: delivery.session.id, pushToken: token },
            data: { pushToken: null, pushDisabledAt: new Date() },
          }),
        ]);
        continue;
      }

      // FAILED (hoặc DISABLED khi cấu hình đổi giữa chừng): thử lại với giãn cách mũ cho tới khi hết lượt.
      const attemptsAfterClaim = delivery.attempts + 1;
      const isExhausted = attemptsAfterClaim >= getNotificationMaxDeliveryAttempts();
      if (isExhausted) summary.exhausted += 1;
      else summary.failed += 1;
      const retryDelay = RETRY_BASE_DELAY_MS * 2 ** Math.min(delivery.attempts, 6);
      await prisma.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: isExhausted ? "EXHAUSTED" : "FAILED",
          lastError: "error" in result ? result.error : "FCM chưa được cấu hình",
          nextAttemptAt: isExhausted ? null : new Date(Date.now() + retryDelay),
        },
      });
    }

    return summary;
  }

  // Thông báo đã hết dòng chờ gửi thì đánh dấu đã chuyển phát xong. Hai truy vấn cho cả lô (bản cũ đếm riêng từng thông báo).
  private async markDispatched(notificationIds: string[]) {
    if (notificationIds.length === 0) return;
    const stillPending = await prisma.notificationDelivery.groupBy({
      by: ["notificationId"],
      where: { notificationId: { in: notificationIds }, status: { in: ["PENDING", "FAILED"] } },
    });
    const pendingIds = new Set(stillPending.map((group) => group.notificationId));
    const finished = notificationIds.filter((notificationId) => !pendingIds.has(notificationId));
    if (finished.length === 0) return;
    await prisma.notification.updateMany({
      where: { id: { in: finished }, dispatchedAt: null },
      data: { dispatchedAt: new Date() },
    });
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

    const configured = FcmPushService.isConfigured();
    if (!configured) {
      return { configured, published: published.count, scanned: 0, ...emptySummary(), errors: 0 };
    }

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
      include: deliveryInclude,
      orderBy: { createdAt: "asc" },
      take: Math.max(1, Math.min(limit, 500)),
    });

    const summary = { configured, published: published.count, scanned: due.length, ...emptySummary(), errors: 0 };
    if (due.length === 0) return summary;

    try {
      Object.assign(summary, await this.processDeliveries(due, now));
      await this.markDispatched([...new Set(due.map((delivery) => delivery.notificationId))]);
    } catch (error) {
      summary.errors += 1;
      throw error;
    }
    return summary;
  }

  // Dòng chuyển phát đã có kết quả cuối (đã gửi, bị hủy, token hỏng, hết lượt thử) không còn giá trị vận hành sau ít ngày.
  async cleanupFinished(now = new Date()) {
    const cutoff = new Date(now.getTime() - FINISHED_DELIVERY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const result = await prisma.notificationDelivery.deleteMany({
      where: {
        status: { in: ["SENT", "CANCELLED", "INVALID_TOKEN", "EXHAUSTED"] },
        updatedAt: { lt: cutoff },
      },
    });
    return { deletedCount: result.count };
  }
}

export default new NotificationDeliveryService();
