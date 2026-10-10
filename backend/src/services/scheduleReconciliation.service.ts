import type { AppointmentStatus } from "../../generated/prisma/enums.js";
import { Prisma } from "../../generated/prisma/client.js";
import { getSlotReconciliationBatchSize } from "../config/environment.js";
import { prisma } from "../config/prisma.js";

const RELEASED_APPOINTMENT_STATUSES = new Set<AppointmentStatus>([
  "RESCHEDULED",
  "CANCELLED_BY_PATIENT",
  "CANCELLED_BY_DOCTOR",
  "CANCELLED_BY_ADMIN",
  "NO_SHOW",
]);

type FindingType =
  | "ORPHAN_BOOKED_SLOT"
  | "LINKED_SLOT_NOT_BOOKED"
  | "TERMINAL_APPOINTMENT_STILL_LINKED"
  | "APPOINTMENT_SLOT_MISMATCH";

class ScheduleReconciliationService {
  async reconcile(options: { repair?: boolean; batchSize?: number } = {}) {
    const repair = options.repair ?? true;
    const batchSize = Math.min(
      Math.max(options.batchSize || getSlotReconciliationBatchSize(), 1),
      1_000,
    );
    const terminalStatuses = [...RELEASED_APPOINTMENT_STATUSES];
    const deterministicCandidates = await prisma.doctorTimeSlot.findMany({
      where: {
        OR: [
          { status: "BOOKED", appointment: { is: null } },
          { status: { not: "BOOKED" }, appointment: { isNot: null } },
          { isActive: false, appointment: { isNot: null } },
          { appointment: { is: { status: { in: terminalStatuses } } } },
        ],
      },
      select: { id: true },
      orderBy: { updatedAt: "asc" },
      take: batchSize,
    });
    const remaining = batchSize - deterministicCandidates.length;
    const mismatchCandidates = remaining
      ? await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT slot."id"
          FROM "DoctorTimeSlot" AS slot
          INNER JOIN "Appointment" AS appointment
            ON appointment."timeSlotId" = slot."id"
          WHERE (
            appointment."doctorId" IS DISTINCT FROM slot."doctorId"
            OR appointment."appointmentDate" IS DISTINCT FROM slot."date"
            OR appointment."startTime" IS DISTINCT FROM slot."startTime"
            OR appointment."endTime" IS DISTINCT FROM slot."endTime"
          )
          ORDER BY slot."updatedAt" ASC
          LIMIT ${remaining}
        `)
      : [];
    const candidateIds = [
      ...new Set([
        ...deterministicCandidates.map((candidate) => candidate.id),
        ...mismatchCandidates.map((candidate) => candidate.id),
      ]),
    ].slice(0, batchSize);
    const slots = await prisma.doctorTimeSlot.findMany({
      where: { id: { in: candidateIds } },
      select: {
        id: true,
        doctorId: true,
        date: true,
        startTime: true,
        endTime: true,
        status: true,
        isActive: true,
        appointment: {
          select: {
            id: true,
            doctorId: true,
            appointmentDate: true,
            startTime: true,
            endTime: true,
            status: true,
          },
        },
      },
    });

    const findings: Array<{
      type: FindingType;
      slotId: string;
      appointmentId: string | null;
      repaired: boolean;
    }> = [];

    for (const slot of slots) {
      const appointment = slot.appointment;
      const mismatched = Boolean(
        appointment &&
          (appointment.doctorId !== slot.doctorId ||
            appointment.appointmentDate.getTime() !== slot.date.getTime() ||
            appointment.startTime !== slot.startTime ||
            appointment.endTime !== slot.endTime),
      );

      if (mismatched) {
        findings.push({
          type: "APPOINTMENT_SLOT_MISMATCH",
          slotId: slot.id,
          appointmentId: appointment?.id || null,
          repaired: false,
        });
        continue;
      }

      if (!appointment && slot.status === "BOOKED") {
        const repaired = repair
          ? await this.releaseOrphanSlot(slot.id)
          : false;
        findings.push({
          type: "ORPHAN_BOOKED_SLOT",
          slotId: slot.id,
          appointmentId: null,
          repaired,
        });
        continue;
      }

      if (!appointment) continue;

      if (RELEASED_APPOINTMENT_STATUSES.has(appointment.status)) {
        const repaired = repair
          ? await this.detachTerminalAppointment(slot.id, appointment.id)
          : false;
        findings.push({
          type: "TERMINAL_APPOINTMENT_STILL_LINKED",
          slotId: slot.id,
          appointmentId: appointment.id,
          repaired,
        });
        continue;
      }

      if (slot.status !== "BOOKED" || !slot.isActive) {
        const repaired = repair
          ? await this.markLinkedSlotBooked(slot.id, appointment.id)
          : false;
        findings.push({
          type: "LINKED_SLOT_NOT_BOOKED",
          slotId: slot.id,
          appointmentId: appointment.id,
          repaired,
        });
      }
    }

    return {
      policy: {
        weeklyScheduleChangesAffect: "NEWLY_GENERATED_SLOTS_ONLY",
        bookedSlots: "IMMUTABLE_WHILE_APPOINTMENT_IS_ACTIVE",
        unsafeMismatchRepair: "REPORT_ONLY",
      },
      scanned: slots.length,
      findingCount: findings.length,
      repairedCount: findings.filter((finding) => finding.repaired).length,
      findings,
    };
  }

  private async releaseOrphanSlot(slotId: string) {
    const result = await prisma.doctorTimeSlot.updateMany({
      where: { id: slotId, status: "BOOKED", appointment: { is: null } },
      data: { status: "AVAILABLE", isActive: true, lockReason: null },
    });
    return result.count === 1;
  }

  private async markLinkedSlotBooked(slotId: string, appointmentId: string) {
    const result = await prisma.doctorTimeSlot.updateMany({
      where: { id: slotId, appointment: { is: { id: appointmentId } } },
      data: { status: "BOOKED", isActive: true, lockReason: null },
    });
    return result.count === 1;
  }

  private async detachTerminalAppointment(slotId: string, appointmentId: string) {
    return prisma.$transaction(async (tx) => {
      const detached = await tx.appointment.updateMany({
        where: {
          id: appointmentId,
          timeSlotId: slotId,
          status: { in: [...RELEASED_APPOINTMENT_STATUSES] },
        },
        data: { timeSlotId: null },
      });
      if (detached.count !== 1) return false;

      await tx.doctorTimeSlot.update({
        where: { id: slotId },
        data: { status: "AVAILABLE", isActive: true, lockReason: null },
      });
      return true;
    });
  }
}

export default new ScheduleReconciliationService();
