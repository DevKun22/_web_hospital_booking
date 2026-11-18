import { AuthSessionService, NotificationService, assert, emailOf, prisma, test } from "./support/context.js";
import FcmPushService from "../../src/services/fcmPush.service.js";
import NotificationDeliveryService from "../../src/services/notificationDelivery.service.js";

// Chuyển phát thông báo đẩy: chỉ sinh dòng khi người dùng bật loại thông báo, gửi FCM theo lô, dọn dòng đã xong.

type PushInput = { token: string; title: string };
type PushResult = { outcome: "SENT"; providerMessageId: string } | { outcome: "INVALID_TOKEN" | "FAILED"; error: string };

const withStubbedFcm = async (handler: (inputs: PushInput[]) => PushResult[], run: () => Promise<void>) => {
  const service = FcmPushService as unknown as { isConfigured: () => boolean; sendBatch: (inputs: PushInput[]) => Promise<PushResult[]> };
  const original = { isConfigured: service.isConfigured, sendBatch: service.sendBatch };
  const calls: PushInput[][] = [];
  service.isConfigured = () => true;
  service.sendBatch = async (inputs) => {
    calls.push(inputs);
    return handler(inputs);
  };
  try {
    await run();
  } finally {
    service.isConfigured = original.isConfigured;
    service.sendBatch = original.sendBatch;
  }
  return calls;
};

const createPatientWithPush = async (phone: string, pushToken: string) => {
  const user = await prisma.user.create({
    data: { fullName: "Push " + phone, email: emailOf(phone), phone, role: "PATIENT", isEmailVerified: true },
  });
  const created = await AuthSessionService.create({
    userId: user.id,
    kind: "PATIENT",
    expiresAt: new Date(Date.now() + 86_400_000),
    meta: { platform: "android", deviceId: "device-" + phone },
  });
  await prisma.authSession.update({ where: { id: created.session.id }, data: { pushToken } });
  return { user, sessionId: created.session.id };
};

test("no delivery rows are created when the user turned push off for that notification group", async () => {
  const { user } = await createPatientWithPush("0911000001", "push-token-pref-0001");
  await prisma.notificationPreference.create({ data: { userId: user.id, billingPush: false } });

  const muted = await NotificationService.create({ userId: user.id, type: "INVOICE_CREATED", title: "Hóa đơn", body: "Có hóa đơn mới" });
  const allowed = await NotificationService.create({ userId: user.id, type: "APPOINTMENT_CONFIRMED", title: "Lịch", body: "Lịch đã xác nhận" });

  assert.equal(await prisma.notificationDelivery.count({ where: { notificationId: muted.id } }), 0);
  assert.equal(await prisma.notificationDelivery.count({ where: { notificationId: allowed.id } }), 1);
  // Hộp thư vẫn đầy đủ dù không có dòng chuyển phát.
  assert.equal(await prisma.notification.count({ where: { id: muted.id } }), 1);
});

test("due deliveries from different notifications are sent in one FCM batch and each result is recorded", async () => {
  const first = await createPatientWithPush("0911000002", "push-token-batch-sent");
  const second = await createPatientWithPush("0911000003", "push-token-batch-bad");
  const third = await createPatientWithPush("0911000004", "push-token-batch-fail");
  const notices = await Promise.all(
    [first, second, third].map((item, index) =>
      NotificationService.create({ userId: item.user.id, type: "APPOINTMENT_CONFIRMED", title: "Thông báo " + index, body: "Nội dung " + index }),
    ),
  );

  const calls = await withStubbedFcm(
    (inputs) =>
      inputs.map((input): PushResult => {
        if (input.token.endsWith("sent")) return { outcome: "SENT", providerMessageId: "msg-1" };
        if (input.token.endsWith("bad")) return { outcome: "INVALID_TOKEN", error: "not registered" };
        return { outcome: "FAILED", error: "temporarily unavailable" };
      }),
    async () => {
      const summary = await NotificationDeliveryService.dispatchDue(100);
      assert.equal(summary.scanned, 3);
      assert.equal(summary.sent, 1);
      assert.equal(summary.invalid, 1);
      assert.equal(summary.failed, 1);
    },
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].length, 3);

  const delivery = async (sessionId: string) => prisma.notificationDelivery.findFirstOrThrow({ where: { sessionId } });
  assert.equal((await delivery(first.sessionId)).status, "SENT");
  const bad = await delivery(second.sessionId);
  assert.equal(bad.status, "INVALID_TOKEN");
  assert.equal((await prisma.authSession.findUniqueOrThrow({ where: { id: second.sessionId } })).pushToken, null);
  const failed = await delivery(third.sessionId);
  assert.equal(failed.status, "FAILED");
  assert.ok(failed.nextAttemptAt && failed.nextAttemptAt.getTime() > Date.now());

  // Thông báo đã gửi xong được đánh dấu chuyển phát; thông báo còn chờ thử lại thì chưa.
  assert.ok((await prisma.notification.findUniqueOrThrow({ where: { id: notices[0].id } })).dispatchedAt);
  assert.equal((await prisma.notification.findUniqueOrThrow({ where: { id: notices[2].id } })).dispatchedAt, null);
});

test("finished delivery rows are cleaned up after the retention window but pending ones stay", async () => {
  const { user, sessionId } = await createPatientWithPush("0911000005", "push-token-cleanup-001");
  const make = async (status: "SENT" | "PENDING" | "EXHAUSTED") => {
    const notice = await NotificationService.create({ userId: user.id, type: "APPOINTMENT_CONFIRMED", title: "t " + status, body: "b" });
    await prisma.notificationDelivery.deleteMany({ where: { notificationId: notice.id } });
    return prisma.notificationDelivery.create({ data: { notificationId: notice.id, sessionId, status } });
  };
  const oldSent = await make("SENT");
  const oldPending = await make("PENDING");
  const recentExhausted = await make("EXHAUSTED");
  const longAgo = new Date(Date.now() - 30 * 86_400_000);
  await prisma.$executeRaw`UPDATE "NotificationDelivery" SET "updatedAt" = ${longAgo} WHERE id IN (${oldSent.id}, ${oldPending.id})`;

  const result = await NotificationDeliveryService.cleanupFinished();
  assert.equal(result.deletedCount, 1);
  assert.equal(await prisma.notificationDelivery.count({ where: { id: oldSent.id } }), 0);
  assert.equal(await prisma.notificationDelivery.count({ where: { id: oldPending.id } }), 1);
  assert.equal(await prisma.notificationDelivery.count({ where: { id: recentExhausted.id } }), 1);
});
