import { Prisma } from "../../generated/prisma/client.js";
import {
  getOutboxDispatchBatchSize,
  getOutboxDispatchConcurrency,
  getOutboxLeaseMs,
  getOutboxMaxAttempts,
  getOutboxRetentionDays,
} from "../config/environment.js";
import { databaseSchema, prisma } from "../config/prisma.js";
import { mapWithConcurrency } from "../utils/concurrency.js";
import AccountChangeNoticeService from "./accountChangeNotice.service.js";
import type { AccountChangeKind } from "./emailTemplates/accountChange.template.js";

type DatabaseClient = Prisma.TransactionClient | typeof prisma;

const ACCOUNT_CHANGE_NOTICE = "ACCOUNT_CHANGE_NOTICE";
// Prisma adapter áp dụng `schema=` cho model query nhưng raw SQL cần qualify rõ.
// databaseSchema đã được config/prisma.ts kiểm tra chỉ chứa identifier an toàn.
const outboxEventTable = Prisma.raw(`"${databaseSchema}"."OutboxEvent"`);
const accountChangeKinds = new Set<AccountChangeKind>([
  "EMAIL_CHANGED",
  "PHONE_CHANGED",
  "ROLE_CHANGED",
  "PASSWORD_RESET",
]);

type ClaimedOutboxEvent = {
  id: string;
  type: string;
  payload: Prisma.JsonValue;
  attempts: number;
};

const parseAccountChangePayload = (payload: Prisma.JsonValue) => {
  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    throw new Error("Invalid account change outbox payload");
  }
  const email = payload.email;
  const changes = payload.changes;
  if (
    typeof email !== "string" ||
    !Array.isArray(changes) ||
    changes.length === 0 ||
    !changes.every(
      (change): change is AccountChangeKind =>
        typeof change === "string" &&
        accountChangeKinds.has(change as AccountChangeKind),
    )
  ) {
    throw new Error("Invalid account change outbox payload");
  }
  return { email, changes };
};

class OutboxEventService {
  enqueueAccountChangeNotice(
    input: {
      email: string | null | undefined;
      changes: AccountChangeKind[];
      dedupeKey: string;
    },
    client: DatabaseClient,
  ) {
    if (!input.email || input.changes.length === 0) return null;
    return client.outboxEvent.upsert({
      where: { dedupeKey: input.dedupeKey },
      update: {},
      create: {
        type: ACCOUNT_CHANGE_NOTICE,
        dedupeKey: input.dedupeKey,
        payload: { email: input.email, changes: input.changes },
      },
    });
  }

  private async claimDue(limit: number, now: Date) {
    const leaseExpiredBefore = new Date(now.getTime() - getOutboxLeaseMs());
    return prisma.$transaction(async (tx) => {
      const events = await tx.$queryRaw<ClaimedOutboxEvent[]>(Prisma.sql`
        SELECT "id", "type", "payload", "attempts"
        FROM ${outboxEventTable}
        WHERE (
          ("status" = 'PENDING' AND "availableAt" <= ${now})
          OR ("status" = 'PROCESSING' AND "lockedAt" <= ${leaseExpiredBefore})
        )
        ORDER BY "availableAt" ASC, "createdAt" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      `);
      if (events.length === 0) return [];

      await tx.outboxEvent.updateMany({
        where: { id: { in: events.map((event) => event.id) } },
        data: {
          status: "PROCESSING",
          lockedAt: now,
          attempts: { increment: 1 },
        },
      });
      return events.map((event) => ({ ...event, attempts: event.attempts + 1 }));
    });
  }

  private async deliver(event: ClaimedOutboxEvent) {
    if (event.type === ACCOUNT_CHANGE_NOTICE) {
      await AccountChangeNoticeService.send(
        parseAccountChangePayload(event.payload),
      );
      return;
    }
    throw new Error(`Unsupported outbox event type: ${event.type}`);
  }

  async dispatchDue(limit = getOutboxDispatchBatchSize(), now = new Date()) {
    const events = await this.claimDue(Math.max(1, Math.min(limit, 200)), now);
    const maxAttempts = getOutboxMaxAttempts();
    const results = await mapWithConcurrency(
      events,
      getOutboxDispatchConcurrency(),
      async (event) => {
        try {
          await this.deliver(event);
          await prisma.outboxEvent.updateMany({
            where: { id: event.id, status: "PROCESSING", lockedAt: now },
            data: {
              status: "PROCESSED",
              processedAt: new Date(),
              lockedAt: null,
              lastError: null,
            },
          });
          return "processed" as const;
        } catch (error) {
          const exhausted = event.attempts >= maxAttempts;
          const retryDelayMs = 30_000 * 2 ** Math.min(event.attempts - 1, 6);
          await prisma.outboxEvent.updateMany({
            where: { id: event.id, status: "PROCESSING", lockedAt: now },
            data: {
              status: exhausted ? "FAILED" : "PENDING",
              availableAt: exhausted
                ? now
                : new Date(now.getTime() + retryDelayMs),
              lockedAt: null,
              lastError: (error instanceof Error
                ? error.message
                : "Unknown outbox delivery error"
              ).slice(0, 1_000),
            },
          });
          console.error(
            `[OUTBOX] event=${event.id} type=${event.type} attempt=${event.attempts} failed:`,
            error,
          );
          return exhausted ? ("failed" as const) : ("retry" as const);
        }
      },
    );

    return {
      scanned: events.length,
      processed: results.filter((result) => result === "processed").length,
      retrying: results.filter((result) => result === "retry").length,
      failed: results.filter((result) => result === "failed").length,
    };
  }

  async cleanupProcessed(now = new Date()) {
    const before = new Date(
      now.getTime() - getOutboxRetentionDays() * 24 * 60 * 60 * 1_000,
    );
    const result = await prisma.outboxEvent.deleteMany({
      where: { status: "PROCESSED", processedAt: { lte: before } },
    });
    return { deletedCount: result.count, before };
  }
}

export default new OutboxEventService();
