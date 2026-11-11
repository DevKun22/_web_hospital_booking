import PolicyService from "../policy.service.js";
import { prisma } from "../../config/prisma.js";
import {
  getAppointmentReconciliationBatchSize,
  getReconciliationConcurrency,
} from "../../config/environment.js";
import { AppError } from "../../utils/appError.js";
import { mapWithConcurrency } from "../../utils/concurrency.js";
import { getVietnamNowParts, parseDateOnly } from "../../utils/time.js";
import { type Actor } from "./appointment.shared.js";
import { AppointmentServiceSupport } from "./appointment.support.js";
import type { AppointmentTransitionUseCases } from "./appointmentTransition.service.js";
export class AppointmentLifecycleUseCases extends AppointmentServiceSupport {
  constructor(
    private readonly transitions: Pick<AppointmentTransitionUseCases, "markNoShow">,
  ) {
    super();
  }

  async reconcileNoShows(options: { now?: Date; batchSize?: number } = {}) {
    const { noShowGraceMinutes } = await PolicyService.get();
    if (noShowGraceMinutes <= 0) return { scanned: 0, marked: 0, noop: 0 };

    const now = options.now || new Date();
    const candidates = await prisma.appointment.findMany({
      where: {
        status: "CONFIRMED",
        appointmentDate: { lte: new Date(now.getTime() + 24 * 3_600_000) },
      },
      select: { id: true, appointmentDate: true, startTime: true },
      orderBy: { appointmentDate: "asc" },
      take: Math.max(options.batchSize || 200, 1),
    });
    const due = candidates.filter(
      (item) =>
        this.getAppointmentStartAt(item.appointmentDate, item.startTime).getTime() +
          noShowGraceMinutes * 60_000 <=
        now.getTime(),
    );

    const outcomes = await mapWithConcurrency(
      due,
      getReconciliationConcurrency(),
      async (item) => {
        try {
          await this.transitions.markNoShow(
            item.id,
            undefined,
            `Tự động đánh dấu vắng mặt: quá ${noShowGraceMinutes} phút chưa check-in`,
          );
          return "MARKED" as const;
        } catch (error) {
          if (error instanceof AppError && error.code === "APPOINTMENT_STATE_CONFLICT") {
            return "NOOP" as const;
          }
          throw error;
        }
      },
    );
    const marked = outcomes.filter((outcome) => outcome === "MARKED").length;
    const noop = outcomes.length - marked;
    return { scanned: due.length, marked, noop };
  }

  async expirePendingOtpAppointment(
    appointmentId: string,
    options: {
      actor?: Actor;
      now?: Date;
      fallbackExpireMinutes?: number;
    } = {},
  ) {
    const now = options.now || new Date();
    const fallbackExpireMinutes = Math.max(
      options.fallbackExpireMinutes ||
        (await PolicyService.get()).bookingHoldMinutes,
      1,
    );
    const expiredBefore = new Date(
      now.getTime() - fallbackExpireMinutes * 60 * 1000,
    );

    return prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUnique({
        where: { id: appointmentId },
        select: { timeSlotId: true },
      });

      if (!appointment) return { outcome: "NOT_FOUND" as const };

      const claimed = await tx.appointment.updateMany({
        where: {
          id: appointmentId,
          status: "PENDING_OTP",
          OR: [
            { holdExpiresAt: { lte: now } },
            { holdExpiresAt: null, createdAt: { lte: expiredBefore } },
          ],
        },
        data: {
          status: "CANCELLED_BY_ADMIN",
          cancelledAt: now,
          cancelledByRole: options.actor?.role,
          cancelledById: options.actor?.userId,
          cancelledReason: "Quá hạn xác thực OTP",
        },
      });

      if (claimed.count !== 1) return { outcome: "NOOP" as const };

      await this.releaseAppointmentSlot(
        tx,
        appointmentId,
        appointment.timeSlotId,
      );

      await this.createTransitionLog(tx, {
        appointmentId,
        action: "CANCELLED_BY_ADMIN",
        actor: options.actor,
        note: `Tự động hủy do quá hạn xác thực OTP (${fallbackExpireMinutes} phút)`,
      });

      return { outcome: "EXPIRED" as const };
    });
  }

  async reconcileExpiredPendingOtp(
    options: {
      actor?: Actor;
      now?: Date;
      fallbackExpireMinutes?: number;
      batchSize?: number;
    } = {},
  ) {
    const now = options.now || new Date();
    const fallbackExpireMinutes = Math.max(
      options.fallbackExpireMinutes ||
        (await PolicyService.get()).bookingHoldMinutes,
      1,
    );
    const expiredBefore = new Date(
      now.getTime() - fallbackExpireMinutes * 60 * 1000,
    );
    const candidates = await prisma.appointment.findMany({
      where: {
        status: "PENDING_OTP",
        OR: [
          { holdExpiresAt: { lte: now } },
          { holdExpiresAt: null, createdAt: { lte: expiredBefore } },
        ],
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: Math.max(
        options.batchSize || getAppointmentReconciliationBatchSize(),
        1,
      ),
    });

    const outcomes = await mapWithConcurrency(
      candidates,
      getReconciliationConcurrency(),
      async (candidate) =>
        this.expirePendingOtpAppointment(candidate.id, {
          actor: options.actor,
          now,
          fallbackExpireMinutes,
        }),
    );
    const expired = outcomes.filter(
      (result) => result.outcome === "EXPIRED",
    ).length;
    const noop = outcomes.length - expired;

    return {
      expiredBefore,
      scanned: candidates.length,
      expired,
      noop,
    };
  }

  async expirePastPendingConfirmation(
    appointmentId: string,
    options: { actor?: Actor; now?: Date } = {},
  ) {
    const now = options.now || new Date();
    const reason = "Lịch chờ bệnh viện xác nhận đã quá giờ khám";
    const transition = await prisma.$transaction(async (tx) => {
      const appointment = await tx.appointment.findUnique({
        where: { id: appointmentId },
        select: {
          appointmentDate: true,
          endTime: true,
          timeSlotId: true,
        },
      });

      if (!appointment) return { outcome: "NOT_FOUND" as const };
      const appointmentEnd = this.getAppointmentEndAt(
        appointment.appointmentDate,
        appointment.endTime,
      );
      if (appointmentEnd > now) return { outcome: "NOOP" as const };

      const claimed = await tx.appointment.updateMany({
        where: {
          id: appointmentId,
          status: "PENDING_CONFIRM",
          appointmentDate: appointment.appointmentDate,
          endTime: appointment.endTime,
        },
        data: {
          status: "CANCELLED_BY_ADMIN",
          cancelledAt: now,
          cancelledByRole: options.actor?.role,
          cancelledById: options.actor?.userId,
          cancelledReason: reason,
        },
      });

      if (claimed.count !== 1) return { outcome: "NOOP" as const };

      await this.releaseAppointmentSlot(
        tx,
        appointmentId,
        appointment.timeSlotId,
      );
      await this.createTransitionLog(tx, {
        appointmentId,
        action: "CANCELLED_BY_ADMIN",
        actor: options.actor,
        note: `Tự động hủy: ${reason.toLocaleLowerCase("vi-VN")}`,
      });
      const notification = await this.createAppointmentCancellationNotification(
        tx,
        appointmentId,
        reason,
      );

      return {
        outcome: "EXPIRED" as const,
        notificationId: notification.id,
      };
    });

    return transition;
  }

  async reconcilePastPendingConfirmations(
    options: {
      actor?: Actor;
      now?: Date;
      batchSize?: number;
    } = {},
  ) {
    const now = options.now || new Date();
    const vietnamToday = parseDateOnly(getVietnamNowParts(now).date);
    const candidates = await prisma.appointment.findMany({
      where: {
        status: "PENDING_CONFIRM",
        appointmentDate: { lte: vietnamToday },
      },
      select: { id: true },
      orderBy: [{ appointmentDate: "asc" }, { endTime: "asc" }],
      take: Math.max(
        options.batchSize || getAppointmentReconciliationBatchSize(),
        1,
      ),
    });

    const outcomes = await mapWithConcurrency(
      candidates,
      getReconciliationConcurrency(),
      async (candidate) =>
        this.expirePastPendingConfirmation(candidate.id, {
          actor: options.actor,
          now,
        }),
    );
    const expired = outcomes.filter(
      (result) => result.outcome === "EXPIRED",
    ).length;
    const noop = outcomes.length - expired;

    return { scanned: candidates.length, expired, noop };
  }
}
