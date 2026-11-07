import type { Prisma } from "../../generated/prisma/client.js";
import type { AppointmentLogAction } from "../../generated/prisma/enums.js";

type ClinicalLogInput = {
  action: AppointmentLogAction;
  actorId?: string;
  note: string;
  medicalRecordId?: string;
  prescriptionId?: string;
};

// Nhật ký thao tác lâm sàng: chỉ ghi AI làm GÌ và LÚC NÀO trên lịch hẹn nào,
// không ghi nội dung y tế (chẩn đoán, thuốc, kết quả). Ghi trong cùng transaction
// với thao tác để không có thay đổi nào mà thiếu dấu vết.
export const logClinicalAction = async (
  tx: Prisma.TransactionClient,
  input: ClinicalLogInput,
) => {
  const source = input.medicalRecordId
    ? await tx.medicalRecord.findUnique({
        where: { id: input.medicalRecordId },
        select: { appointmentId: true },
      })
    : input.prescriptionId
      ? await tx.prescription.findUnique({
          where: { id: input.prescriptionId },
          select: { appointmentId: true },
        })
      : null;

  if (!source?.appointmentId) return;

  await tx.appointmentLog.create({
    data: {
      appointmentId: source.appointmentId,
      action: input.action,
      createdById: input.actorId,
      note: input.note,
    },
  });
};
