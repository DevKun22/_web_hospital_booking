import { prisma } from "../../config/prisma.js";
import { toDateOnly } from "../../utils/time.js";
import type { ChatBookingDraft, ChatbotDraftSummary } from "./chatbot.types.js";

// Tóm tắt các lựa chọn đang giữ trong bản nháp đặt lịch bằng tên người đọc được (khoa, gói, bác sĩ, khung giờ),
// để giao diện hiện "bạn đã chọn gì" mà không phải tự tra từng mã. Mỗi tra cứu là một truy vấn theo khóa chính nên nhẹ.

export const buildDraftSummary = async (draft: ChatBookingDraft): Promise<ChatbotDraftSummary | undefined> => {
  if (!draft.departmentId && !draft.packageId && !draft.doctorId && !draft.timeSlotId && !draft.date) return undefined;

  const [department, pack, doctor, slot] = await Promise.all([
    draft.departmentId
      ? prisma.department.findUnique({ where: { id: draft.departmentId }, select: { id: true, name: true } })
      : null,
    draft.packageId
      ? prisma.package.findUnique({ where: { id: draft.packageId }, select: { id: true, name: true, basePrice: true, serviceFee: true } })
      : null,
    draft.doctorId
      ? prisma.doctorProfile.findUnique({
          where: { id: draft.doctorId },
          select: {
            id: true,
            title: true,
            consultationFee: true,
            user: { select: { fullName: true } },
            department: { select: { name: true } },
          },
        })
      : null,
    draft.timeSlotId
      ? prisma.doctorTimeSlot.findUnique({ where: { id: draft.timeSlotId }, select: { id: true, date: true, startTime: true, endTime: true } })
      : null,
  ]);

  return {
    department: department ?? undefined,
    package: pack ? { id: pack.id, name: pack.name, price: pack.basePrice + pack.serviceFee } : undefined,
    doctor: doctor
      ? {
          id: doctor.id,
          name: `${doctor.title ? `${doctor.title} ` : ""}${doctor.user.fullName}`,
          departmentName: doctor.department.name,
          fee: doctor.consultationFee,
        }
      : undefined,
    slot: slot ? { id: slot.id, date: toDateOnly(slot.date), startTime: slot.startTime, endTime: slot.endTime } : undefined,
    date: draft.date,
  };
};
