import { prisma } from "../../config/prisma.js";
import { AppError } from "../../utils/appError.js";
import { isSlotStartInPastVietnamTime } from "../../utils/time.js";
import MedicalRecordService from "../medicalRecord.service.js";
import NotificationService from "../notification.service.js";
import StaffNotificationService from "../staffNotification.service.js";
import {
  DASHBOARD_CANCEL_ALLOWED_STATUSES,
  type Actor,
  type RescheduleAppointmentInput,
} from "./appointment.shared.js";
import { AppointmentServiceSupport } from "./appointment.support.js";
export class AppointmentTransitionUseCases extends AppointmentServiceSupport {
  async confirm(id: string, actor: Actor) {
    const transition = await prisma.$transaction(async (tx) => {
      await this.claimAppointmentTransition(tx, {
        id,
        actor,
        expectedStatuses: ["PENDING_CONFIRM"],
        nextStatus: "CONFIRMED",
        data: { confirmedAt: new Date() },
      });
      await this.createTransitionLog(tx, {
        appointmentId: id,
        action: "CONFIRMED",
        actor,
        note: "Lịch hẹn đã được xác nhận",
      });
      const notification = await this.createAppointmentConfirmationNotification(
        tx,
        id,
      );
      const reminder = await this.createAppointmentReminderNotification(tx, id);
      const appointment = await this.getTransitionResult(tx, id);
      return {
        appointment,
        notificationId: notification.id,
        dueReminderId: reminder?.publishedAt ? reminder.id : null,
      };
    });

    await StaffNotificationService.notifyAppointmentEvent(id, "CONFIRMED", {
      actorId: actor.userId,
    });
    return transition.appointment;
  }

  async cancel(id: string, reason: string, actor: Actor) {
    const cancelStatus =
      actor.role === "DOCTOR" ? "CANCELLED_BY_DOCTOR" : "CANCELLED_BY_ADMIN";
    const cancelAction =
      actor.role === "DOCTOR" ? "CANCELLED_BY_DOCTOR" : "CANCELLED_BY_ADMIN";

    const transition = await prisma.$transaction(async (tx) => {
      await this.claimAppointmentTransition(tx, {
        id,
        actor,
        expectedStatuses: DASHBOARD_CANCEL_ALLOWED_STATUSES,
        nextStatus: cancelStatus,
        data: {
          cancelledAt: new Date(),
          cancelledByRole: actor.role,
          cancelledById: actor.userId,
          cancelledReason: reason,
        },
      });

      await this.releaseAppointmentSlot(tx, id);

      await this.createTransitionLog(tx, {
        appointmentId: id,
        action: cancelAction,
        actor,
        note: reason,
      });

      const notification = await this.createAppointmentCancellationNotification(
        tx,
        id,
        reason,
      );

      const appointment = await this.getTransitionResult(tx, id);
      return { appointment, notificationId: notification.id };
    });

    await StaffNotificationService.notifyAppointmentEvent(id, "CANCELLED", {
      actorId: actor.userId,
    });
    return transition.appointment;
  }

  async reschedule(
    id: string,
    input: RescheduleAppointmentInput,
    actor: Actor,
  ) {
    const reason = input.reason.trim();
    const transition = await prisma.$transaction(async (tx) => {
      const current = await tx.appointment.findFirst({
        where: {
          ...this.getActorScopedAppointmentWhere(id, actor),
          status: "CONFIRMED",
        },
      });
      if (!current) {
        throw new AppError(
          "Chỉ có thể đổi lịch đã được xác nhận",
          409,
          "APPOINTMENT_STATE_CONFLICT",
        );
      }

      const targetSlot = await tx.doctorTimeSlot.findUnique({
        where: { id: input.timeSlotId },
        select: {
          id: true,
          doctorId: true,
          date: true,
          startTime: true,
          endTime: true,
          status: true,
          isActive: true,
          appointment: { select: { id: true } },
        },
      });
      if (
        !targetSlot ||
        targetSlot.doctorId !== current.doctorId ||
        targetSlot.status !== "AVAILABLE" ||
        !targetSlot.isActive ||
        targetSlot.appointment ||
        isSlotStartInPastVietnamTime(targetSlot.date, targetSlot.startTime)
      ) {
        throw new AppError(
          "Khung giờ đổi lịch không khả dụng hoặc không thuộc bác sĩ hiện tại",
          409,
          "APPOINTMENT_SLOT_CONFLICT",
        );
      }

      const reserved = await tx.doctorTimeSlot.updateMany({
        where: {
          id: targetSlot.id,
          doctorId: current.doctorId,
          status: "AVAILABLE",
          isActive: true,
        },
        data: { status: "BOOKED" },
      });
      if (reserved.count !== 1) {
        throw new AppError(
          "Khung giờ đổi lịch vừa được người khác chọn",
          409,
          "APPOINTMENT_SLOT_CONFLICT",
        );
      }

      const claimed = await tx.appointment.updateMany({
        where: {
          id: current.id,
          status: "CONFIRMED",
          timeSlotId: current.timeSlotId,
        },
        data: {
          status: "RESCHEDULED",
          timeSlotId: null,
        },
      });
      if (claimed.count !== 1) {
        throw new AppError(
          "Lịch hẹn đã thay đổi, vui lòng tải lại dữ liệu",
          409,
          "APPOINTMENT_STATE_CONFLICT",
        );
      }

      if (current.timeSlotId) {
        await tx.doctorTimeSlot.update({
          where: { id: current.timeSlotId },
          data: { status: "AVAILABLE", isActive: true, lockReason: null },
        });
      }
      await this.cancelAppointmentReminders(tx, current.id);
      await this.createTransitionLog(tx, {
        appointmentId: current.id,
        action: "RESCHEDULED",
        actor,
        note: reason,
      });

      const rescheduledAt = new Date();
      const created = await tx.appointment.create({
        data: {
          bookingCode: await this.generateUniqueBookingCode(tx),
          appointmentDate: targetSlot.date,
          startTime: targetSlot.startTime,
          endTime: targetSlot.endTime,
          status: "CONFIRMED",
          reason: current.reason,
          patientName: current.patientName,
          patientPhone: current.patientPhone,
          patientEmail: current.patientEmail,
          otpChannel: current.otpChannel,
          patientGender: current.patientGender,
          patientDateOfBirth: current.patientDateOfBirth,
          patientAddress: current.patientAddress,
          patientCccd: current.patientCccd,
          hasBHYT: current.hasBHYT,
          healthInsuranceCode: current.healthInsuranceCode,
          registeredHospital: current.registeredHospital,
          allergies: current.allergies,
          medicalHistory: current.medicalHistory,
          familyHistory: current.familyHistory,
          estimatedPrice: current.estimatedPrice,
          serviceFee: current.serviceFee,
          bhytDiscount: current.bhytDiscount,
          finalAmount: current.finalAmount,
          patientId: current.patientId,
          doctorId: current.doctorId,
          departmentId: current.departmentId,
          packageId: current.packageId,
          timeSlotId: targetSlot.id,
          rescheduledFromId: current.id,
          rescheduledReason: reason,
          rescheduledAt,
          confirmedAt: rescheduledAt,
          logs: {
            create: {
              action: "RESCHEDULED",
              createdById: actor.userId,
              note: `Đổi từ lịch ${current.bookingCode}: ${reason}`,
            },
          },
        },
        select: { id: true, bookingCode: true },
      });

      const notification = await NotificationService.create(
        {
          userId: current.patientId,
          type: "APPOINTMENT_RESCHEDULED",
          title: "Lịch khám đã được đổi",
          body: `Lịch ${current.bookingCode} đã được đổi sang mã ${created.bookingCode}, ngày ${this.formatNotificationDate(targetSlot.date)} lúc ${targetSlot.startTime}.`,
          entityType: "APPOINTMENT",
          entityId: created.id,
          payload: {
            previousAppointmentId: current.id,
            previousBookingCode: current.bookingCode,
            bookingCode: created.bookingCode,
            status: "CONFIRMED",
          },
          dedupeKey: `appointment:${current.id}:rescheduled:${created.id}`,
        },
        tx,
      );
      const reminder = await this.createAppointmentReminderNotification(
        tx,
        created.id,
      );
      const appointment = await this.getTransitionResult(tx, created.id);
      return {
        appointment,
        notificationId: notification.id,
        dueReminderId: reminder?.publishedAt ? reminder.id : null,
      };
    });

    await StaffNotificationService.notifyAppointmentEvent(
      transition.appointment.id,
      "RESCHEDULED",
      { actorId: actor.userId },
    );
    return transition.appointment;
  }

  async checkIn(id: string, actor: Actor) {
    const transition = await prisma.$transaction(async (tx) => {
      await this.claimAppointmentTransition(tx, {
        id,
        actor,
        expectedStatuses: ["CONFIRMED"],
        nextStatus: "CHECKED_IN",
      });
      await this.cancelAppointmentReminders(tx, id);
      await this.createTransitionLog(tx, {
        appointmentId: id,
        action: "CHECKED_IN",
        actor,
        note: "Benh nhan da check-in",
      });
      const notification = await this.createAppointmentProgressNotification(
        tx,
        id,
        "CHECKED_IN",
      );
      const appointment = await this.getTransitionResult(tx, id);
      return { appointment, notificationId: notification.id };
    });

    await StaffNotificationService.notifyAppointmentEvent(id, "CHECKED_IN", {
      actorId: actor.userId,
    });
    return transition.appointment;
  }

  async start(id: string, actor: Actor) {
    const transition = await prisma.$transaction(async (tx) => {
      await this.claimAppointmentTransition(tx, {
        id,
        actor,
        expectedStatuses: ["CHECKED_IN"],
        nextStatus: "IN_PROGRESS",
      });
      await MedicalRecordService.ensureForAppointment(id, tx);
      await this.createTransitionLog(tx, {
        appointmentId: id,
        action: "IN_PROGRESS",
        actor,
        note: "Bắt đầu khám và tạo hồ sơ khám",
      });
      const notification = await this.createAppointmentProgressNotification(
        tx,
        id,
        "IN_PROGRESS",
      );
      const appointment = await this.getTransitionResult(tx, id);
      return { appointment, notificationId: notification.id };
    });

    return transition.appointment;
  }

  async complete(id: string, actor: Actor) {
    const transition = await prisma.$transaction(async (tx) => {
      await this.claimAppointmentTransition(tx, {
        id,
        actor,
        expectedStatuses: ["IN_PROGRESS"],
        nextStatus: "COMPLETED",
        data: { completedAt: new Date() },
      });
      await this.createTransitionLog(tx, {
        appointmentId: id,
        action: "COMPLETED",
        actor,
        note: "Hoàn thành khám",
      });
      const notification = await this.createAppointmentProgressNotification(
        tx,
        id,
        "COMPLETED",
      );
      const appointment = await this.getTransitionResult(tx, id);
      return { appointment, notificationId: notification.id };
    });

    // Lễ tân cần lập hóa đơn cho lịch vừa khám xong.
    await StaffNotificationService.notifyAppointmentEvent(id, "COMPLETED", {
      actorId: actor.userId,
      includeDoctor: false,
      includeReception: true,
    });
    return transition.appointment;
  }

  async markNoShow(id: string, actor?: Actor, note = "Người khám không đến") {
    const transition = await prisma.$transaction(async (tx) => {
      await this.claimAppointmentTransition(tx, {
        id,
        actor,
        expectedStatuses: ["CONFIRMED", "CHECKED_IN"],
        nextStatus: "NO_SHOW",
      });

      await this.releaseAppointmentSlot(tx, id);
      await this.cancelAppointmentReminders(tx, id);

      await this.createTransitionLog(tx, {
        appointmentId: id,
        action: "NO_SHOW",
        actor,
        note,
      });
      const notification = await this.createAppointmentNoShowNotification(
        tx,
        id,
      );
      const appointment = await this.getTransitionResult(tx, id);
      return { appointment, notificationId: notification.id };
    });

    return transition.appointment;
  }

  // Lịch CONFIRMED chưa check-in sau giờ hẹn + noShowGraceMinutes thì tự chuyển NO_SHOW.
  // Mặc định 0 = tắt. Mỗi lịch dùng cùng đường chuyển trạng thái như thao tác tay nên
  // an toàn khi chạy song song với lễ tân.
}
