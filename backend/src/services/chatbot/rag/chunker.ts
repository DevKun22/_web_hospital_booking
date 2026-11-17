import { createHash } from "node:crypto";
import type { KnowledgeDoc } from "./rag.types.js";

// Dựng kho tri thức từ dữ liệu đang có: không có nguồn tri thức thứ hai để quản trị. Mỗi bản ghi nghiệp vụ thành một đoạn
// ngắn, tự đủ nghĩa, để truy hồi trả về đúng đơn vị người dùng hỏi (một gói, một bác sĩ, một câu hỏi thường gặp).

const money = (value: number) => `${value.toLocaleString("vi-VN")} đồng`;

const lines = (...parts: (string | null | undefined | false | 0)[]) =>
  parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .map((part) => part.trim())
    .join("\n");

export const faqDoc = (faq: { id: string; question: string; answer: string }): KnowledgeDoc => ({
  sourceType: "FAQ",
  sourceId: faq.id,
  title: faq.question,
  url: "/hoi-dap",
  content: lines(`Câu hỏi: ${faq.question}`, `Trả lời: ${faq.answer}`),
});

export const departmentDoc = (department: {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  triageDescription: string | null;
  symptomKeywords: string[];
}): KnowledgeDoc => ({
  sourceType: "DEPARTMENT",
  sourceId: department.id,
  title: department.name,
  url: department.slug ? `/chuyen-khoa/${department.slug}` : null,
  content: lines(
    `Chuyên khoa ${department.name}.`,
    department.description,
    department.triageDescription,
    department.symptomKeywords.length > 0 && `Triệu chứng, vấn đề thường gặp: ${department.symptomKeywords.join(", ")}.`,
  ),
});

export const doctorDoc = (doctor: {
  id: string;
  slug: string;
  title: string | null;
  specialization: string | null;
  bio: string | null;
  experience: number | null;
  consultationFee: number;
  user: { fullName: string };
  department: { name: string };
}): KnowledgeDoc => {
  const name = `${doctor.title ? `${doctor.title} ` : ""}${doctor.user.fullName}`;
  return {
    sourceType: "DOCTOR",
    sourceId: doctor.id,
    title: name,
    url: `/bac-si/${doctor.slug}`,
    content: lines(
      `Bác sĩ ${name}, chuyên khoa ${doctor.department.name}.`,
      doctor.specialization && `Chuyên môn: ${doctor.specialization}.`,
      doctor.experience != null && `Kinh nghiệm: ${doctor.experience} năm.`,
      `Phí khám: ${money(doctor.consultationFee)}.`,
      doctor.bio,
    ),
  };
};

export const packageDoc = (pack: {
  id: string;
  name: string;
  slug: string | null;
  summary: string | null;
  description: string | null;
  note: string | null;
  basePrice: number;
  serviceFee: number;
  isBHYTSupport: boolean;
  department: { name: string } | null;
  items: { name: string; included: boolean }[];
}): KnowledgeDoc => {
  const included = pack.items.filter((item) => item.included).map((item) => item.name);
  return {
    sourceType: "PACKAGE",
    sourceId: pack.id,
    title: pack.name,
    url: pack.slug ? `/goi-kham/${pack.slug}` : null,
    content: lines(
      `Gói khám ${pack.name}${pack.department ? `, thuộc chuyên khoa ${pack.department.name}` : ""}.`,
      pack.summary,
      pack.description,
      `Giá: ${money(pack.basePrice + pack.serviceFee)}.`,
      included.length > 0 && `Hạng mục gồm: ${included.join(", ")}.`,
      pack.isBHYTSupport && "Gói có hỗ trợ bảo hiểm y tế.",
      pack.note && `Lưu ý: ${pack.note}`,
    ),
  };
};

export const policyDoc = (policy: {
  bookingHoldMinutes: number;
  reminderLeadMinutes: number;
  patientCancelCutoffHours: number;
}): KnowledgeDoc => ({
  sourceType: "POLICY",
  sourceId: "booking-policy",
  title: "Chính sách đặt lịch, hủy lịch và nhắc lịch",
  url: "/huong-dan/dat-lich",
  content: lines(
    `Khi đặt lịch, khung giờ được giữ ${policy.bookingHoldMinutes} phút để người khám xác thực OTP; quá thời hạn mà chưa xác thực thì khung giờ được nhả ra.`,
    policy.patientCancelCutoffHours > 0
      ? `Người khám tự hủy lịch được cho đến ${policy.patientCancelCutoffHours} giờ trước giờ khám; sau mốc này cần liên hệ nhân viên.`
      : "Người khám có thể tự hủy lịch bất cứ lúc nào trước giờ khám.",
    `Hệ thống nhắc lịch khám trước giờ hẹn khoảng ${Math.round(policy.reminderLeadMinutes / 60)} giờ.`,
    "Lịch đặt online sau khi xác thực OTP được xác nhận ngay.",
  ),
});

export const siteDoc = (site: {
  hospitalName?: string | null;
  hotline?: string | null;
  emergencyHotline?: string | null;
  email?: string | null;
  address?: string | null;
  workingHours?: string | null;
}): KnowledgeDoc | null => {
  const name = site.hospitalName || "cơ sở khám";
  const content = lines(
    site.address && `Địa chỉ: ${site.address}.`,
    site.workingHours && `Giờ làm việc: ${site.workingHours}.`,
    site.hotline && `Đường dây nóng: ${site.hotline}.`,
    site.emergencyHotline && `Số cấp cứu: ${site.emergencyHotline}.`,
    site.email && `Email liên hệ: ${site.email}.`,
  );
  if (!content) return null;
  return {
    sourceType: "SITE",
    sourceId: "site-contact",
    title: `Thông tin liên hệ ${name}`,
    url: "/ho-tro",
    content: `Thông tin liên hệ và giờ làm việc của ${name}.\n${content}`,
  };
};

export const contentHash = (doc: KnowledgeDoc) =>
  createHash("sha256").update(`${doc.title}\n${doc.url ?? ""}\n${doc.content}`).digest("hex");
