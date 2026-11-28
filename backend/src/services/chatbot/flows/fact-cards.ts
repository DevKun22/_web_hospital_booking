import { prisma } from "../../../config/prisma.js";
import type { ChatbotFactCard, ChatFocus } from "../chatbot.types.js";
import { money } from "../rag/chunker.js";

// Thẻ thông tin có cấu trúc (giá, hạng mục, phí khám) đứng cạnh câu trả lời về một gói khám hoặc bác sĩ. Số liệu đọc thẳng từ dữ liệu
// hiện hành, không do AI viết: người đọc quét được nhanh và không phụ thuộc AI diễn đạt đúng con số.

const SHOWN_ITEMS = 3;

const packageCard = async (id: string): Promise<ChatbotFactCard | null> => {
  const pack = await prisma.package.findFirst({
    where: { id, isActive: true },
    select: { id: true, name: true, basePrice: true, serviceFee: true, resultTime: true, items: { select: { name: true, included: true } } },
  });
  if (!pack) return null;
  const included = pack.items.filter((item) => item.included).map((item) => item.name);
  const rows: ChatbotFactCard["rows"] = [{ label: "Giá", value: money(pack.basePrice + pack.serviceFee) }];
  if (included.length > 0) rows.push({ label: "Hạng mục", value: `${included.length} hạng mục` });
  if (pack.resultTime?.trim()) rows.push({ label: "Có kết quả", value: pack.resultTime.trim() });
  const shown = included.slice(0, SHOWN_ITEMS).join(", ");
  const rest = included.length - SHOWN_ITEMS;
  return {
    kind: "package",
    id: pack.id,
    title: pack.name,
    rows,
    note: included.length === 0 ? undefined : rest > 0 ? `${shown}, và ${rest} mục khác` : shown,
  };
};

const doctorCard = async (id: string): Promise<ChatbotFactCard | null> => {
  const doctor = await prisma.doctorProfile.findFirst({
    where: { id, isAvailable: true, user: { isActive: true } },
    select: { id: true, title: true, consultationFee: true, department: { select: { name: true } }, user: { select: { fullName: true } } },
  });
  if (!doctor) return null;
  return {
    kind: "doctor",
    id: doctor.id,
    title: `${doctor.title ? `${doctor.title} ` : ""}${doctor.user.fullName}`,
    rows: [
      { label: "Phí khám", value: money(doctor.consultationFee) },
      { label: "Chuyên khoa", value: doctor.department.name },
    ],
  };
};

/** Thẻ cho chủ đề Kun vừa trả lời (gói khám hoặc bác sĩ); không có thẻ cho chuyên khoa hay chính sách. Lỗi tra cứu không được làm mất câu trả lời. */
export const buildFactCards = async (focus: ChatFocus | null | undefined): Promise<ChatbotFactCard[] | undefined> => {
  if (!focus) return undefined;
  try {
    const card = focus.type === "package" ? await packageCard(focus.id) : focus.type === "doctor" ? await doctorCard(focus.id) : null;
    return card ? [card] : undefined;
  } catch {
    return undefined;
  }
};
