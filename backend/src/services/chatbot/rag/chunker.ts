import { createHash } from "node:crypto";
import { createSlug } from "../../../utils/slug.js";
import type { KnowledgeDoc } from "./rag.types.js";

// Dựng kho tri thức từ dữ liệu đang có: không có nguồn tri thức thứ hai để quản trị. Mỗi bản ghi nghiệp vụ thành một đoạn
// ngắn, tự đủ nghĩa, để truy hồi trả về đúng đơn vị người dùng hỏi (một gói, một bác sĩ, một câu hỏi thường gặp).

const money = (value: number) => `${value.toLocaleString("vi-VN")} đồng`;

// Cột JSON của nội dung công khai: dữ liệu đã qua kiểm tra khi lưu, nhưng ở đây vẫn đọc phòng thủ để dữ liệu hỏng không làm hỏng việc dựng kho tri thức.
const asArray = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null) : [];
const asStrings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []);
const text = (value: unknown) => (typeof value === "string" ? value : "");

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

// Mỗi mục giới thiệu của chuyên khoa (Tổng quan, Dịch vụ, Thiết bị...) là một đoạn riêng để truy hồi đúng mục người dùng hỏi.
export const departmentSectionDocs = (department: {
  id: string;
  name: string;
  slug: string;
  sections: unknown;
}): KnowledgeDoc[] =>
  // Giữ nguyên chỉ số gốc của mục (kể cả khi bỏ mục trống) để mã đoạn không đổi khi các mục khác thay đổi.
  asArray(department.sections).flatMap((section, index) =>
    text(section.title) && text(section.body)
      ? [
          {
            sourceType: "DEPARTMENT" as const,
            sourceId: `${department.id}#${index}`,
            title: department.name,
            url: `/chuyen-khoa/${department.slug}#${createSlug(text(section.title))}`,
            content: lines(`Chuyên khoa ${department.name}, mục "${text(section.title)}".`, text(section.body)),
          },
        ]
      : [],
  );

export const doctorDoc = (doctor: {
  id: string;
  slug: string;
  title: string | null;
  specialization: string | null;
  bio: string | null;
  motto: string | null;
  careerTimeline: unknown;
  memberships: unknown;
  expertise: unknown;
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
      doctor.motto && `Tâm niệm nghề nghiệp: ${doctor.motto}`,
      asStrings(doctor.expertise).length > 0 && `Lĩnh vực chuyên sâu: ${asStrings(doctor.expertise).join(", ")}.`,
      asArray(doctor.careerTimeline).length > 0 &&
        `Quá trình công tác: ${asArray(doctor.careerTimeline)
          .map((item) => `${text(item.period)} ${text(item.place)}${text(item.role) ? ` (${text(item.role)})` : ""}`)
          .join("; ")}.`,
      asStrings(doctor.memberships).length > 0 && `Hiệp hội chuyên môn: ${asStrings(doctor.memberships).join(", ")}.`,
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
  audience: unknown;
  resultTime: string | null;
  faq: unknown;
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
      asStrings(pack.audience).length > 0 && `Đối tượng nên làm: ${asStrings(pack.audience).join("; ")}.`,
      pack.resultTime && `Thời gian có kết quả: ${pack.resultTime}.`,
      ...asArray(pack.faq).map((item) => `Hỏi: ${text(item.question)} Đáp: ${text(item.answer)}`),
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

const WEEKDAY_LABELS = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

/**
 * Lịch khám đặt được trên hệ thống, dựng từ ca làm việc mẫu đang hoạt động của bác sĩ. Tách khỏi "giờ làm việc" của cơ sở
 * (thông tin liên hệ) để chatbot không lẫn giờ mở cửa với giờ còn đặt lịch được: ngày không có ca nào được nói rõ là không nhận đặt lịch.
 * Còn trống giờ nào thì luôn tra khung giờ trong DB, không lấy từ đoạn này.
 */
export const bookingScheduleDoc = (schedules: { dayOfWeek: number; startTime: string; endTime: string }[]): KnowledgeDoc | null => {
  if (!schedules.length) return null;
  const byDay = new Map<number, { start: string; end: string }>();
  for (const item of schedules) {
    const current = byDay.get(item.dayOfWeek);
    byDay.set(item.dayOfWeek, {
      start: !current || item.startTime < current.start ? item.startTime : current.start,
      end: !current || item.endTime > current.end ? item.endTime : current.end,
    });
  }
  const order = [1, 2, 3, 4, 5, 6, 0];
  const open = order.filter((day) => byDay.has(day));
  const closed = order.filter((day) => !byDay.has(day));
  return {
    sourceType: "POLICY",
    sourceId: "booking-schedule",
    title: "Lịch khám có thể đặt online",
    url: "/dat-lich",
    content: lines(
      `Các ngày có lịch khám đặt online: ${open.map((day) => `${WEEKDAY_LABELS[day]} (${byDay.get(day)!.start}–${byDay.get(day)!.end})`).join(", ")}.`,
      closed.length ? `${closed.map((day) => WEEKDAY_LABELS[day]).join(", ")}: không có lịch khám đặt online.` : null,
      "Giờ còn trống cụ thể thay đổi liên tục; hãy xem lịch trống khi đặt lịch.",
    ),
  };
};

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
    // Gọi cùng một thông tin bằng các từ người dùng hay hỏi (số điện thoại, đường dây nóng; giờ làm việc, giờ mở cửa) để tìm theo từ cũng bắt được.
    site.address && `Địa chỉ cơ sở khám: ${site.address}.`,
    site.workingHours && `Giờ làm việc (giờ mở cửa, giờ khám): ${site.workingHours}.`,
    site.hotline && `Số điện thoại liên hệ (đường dây nóng, hotline): ${site.hotline}.`,
    site.emergencyHotline && `Số điện thoại cấp cứu của cơ sở: ${site.emergencyHotline}.`,
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

// ---- Bài viết kiến thức sức khỏe ----

/** Mỗi đoạn tri thức của bài dài tối đa chừng này ký tự: đủ ý, không loãng. */
const ARTICLE_CHUNK_CHARS = 1200;
/** Mục quá ngắn được gộp với mục kế tiếp. */
const ARTICLE_MIN_SECTION_CHARS = 250;

/** Bỏ ký hiệu Markdown, giữ chữ: AI và tìm theo từ đọc văn bản thuần. */
export const stripMarkdown = (value: string) =>
  value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|\*|_|`)/g, "")
    .replace(/^[ \t]*>[ \t]?/gm, "")
    .replace(/^[ \t]*[-*+][ \t]+/gm, "- ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

type Section = { heading: string | null; body: string };

/** Cắt bài Markdown theo tiêu đề mục (## hoặc ###), rồi gộp mục ngắn và tách mục dài theo đoạn văn. */
export const splitArticleSections = (markdown: string): Section[] => {
  const raw: Section[] = [];
  let current: Section = { heading: null, body: "" };
  for (const line of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const heading = line.match(/^#{2,3}\s+(.+?)\s*#*$/);
    if (heading) {
      raw.push(current);
      current = { heading: stripMarkdown(heading[1]), body: "" };
    } else {
      current.body += `${line}\n`;
    }
  }
  raw.push(current);

  const sections: Section[] = [];
  for (const section of raw) {
    const body = stripMarkdown(section.body);
    if (!body && !section.heading) continue;
    const previous = sections[sections.length - 1];
    // Mục trước quá ngắn thì nhập vào mục này (mục này giữ tiêu đề và neo của nó, để liên kết nguồn trỏ đúng chỗ).
    if (previous && previous.body.length < ARTICLE_MIN_SECTION_CHARS) {
      sections.pop();
      const lead = previous.heading ? `${previous.heading}. ${previous.body}` : previous.body;
      sections.push({ heading: section.heading, body: `${lead}\n${body}`.trim() });
      continue;
    }
    sections.push({ heading: section.heading, body });
  }

  const result: Section[] = [];
  for (const section of sections) {
    if (section.body.length <= ARTICLE_CHUNK_CHARS) {
      result.push(section);
      continue;
    }
    let buffer = "";
    for (const paragraph of section.body.split(/\n{2,}/)) {
      if (buffer && buffer.length + paragraph.length > ARTICLE_CHUNK_CHARS) {
        result.push({ heading: section.heading, body: buffer.trim() });
        buffer = "";
      }
      buffer += `${paragraph}\n\n`;
    }
    if (buffer.trim()) result.push({ heading: section.heading, body: buffer.trim() });
  }
  return result;
};

/** Một bài viết thành nhiều đoạn tri thức; đường dẫn trỏ tới đúng mục (neo theo slug của tiêu đề mục). */
export const articleDocs = (article: {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  content: string;
  department: { name: string } | null;
}): KnowledgeDoc[] =>
  splitArticleSections(article.content).map((section, index) => {
    const anchor = section.heading ? createSlug(section.heading) : "";
    return {
      sourceType: "ARTICLE" as const,
      sourceId: `${article.id}#${index}`,
      title: article.title,
      url: `/kien-thuc/${article.slug}${anchor ? `#${anchor}` : ""}`,
      content: lines(
        `Bài viết kiến thức sức khỏe "${article.title}"${section.heading ? `, mục "${section.heading}"` : ""}.`,
        index === 0 && article.summary,
        index === 0 && article.department && `Liên quan chuyên khoa ${article.department.name}.`,
        section.body,
      ),
    };
  });

export const contentHash = (doc: KnowledgeDoc) =>
  createHash("sha256").update(`${doc.title}\n${doc.url ?? ""}\n${doc.content}`).digest("hex");

// ---- Điều khoản sử dụng và chính sách bảo mật (văn bản do cơ sở soạn; chưa soạn thì không có đoạn nào) ----

const LEGAL_PAGES = {
  terms: { label: "Điều khoản sử dụng", url: "/dieu-khoan" },
  privacy: { label: "Chính sách bảo mật", url: "/chinh-sach-bao-mat" },
} as const;

export const legalDocs = (key: keyof typeof LEGAL_PAGES, doc: { title: string; body: string } | null): KnowledgeDoc[] => {
  if (!doc || !doc.body.trim()) return [];
  const page = LEGAL_PAGES[key];
  const title = doc.title.trim() || page.label;
  return splitArticleSections(doc.body).map((section, index) => ({
    sourceType: "LEGAL" as const,
    sourceId: `${key}#${index}`,
    title,
    url: page.url,
    content: lines(`${page.label} của cơ sở khám${section.heading ? `, mục "${section.heading}"` : ""}.`, section.body),
  }));
};
