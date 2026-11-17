import { prisma } from "../../../config/prisma.js";
import FAQService from "../../faq.service.js";
import PolicyService from "../../policy.service.js";
import SiteSettingsService from "../../siteSettings.service.js";
import { articleDocs, departmentDoc, doctorDoc, faqDoc, packageDoc, policyDoc, siteDoc } from "./chunker.js";
import type { KnowledgeDoc } from "./rag.types.js";

// Đọc các nguồn dữ liệu nghiệp vụ đang hoạt động (chỉ đọc) để dựng kho tri thức; cách dựng từng đoạn nằm ở chunker.ts.

/** Đọc mọi nguồn đang hoạt động và dựng thành các đoạn tri thức. */
export const buildKnowledgeDocs = async (): Promise<KnowledgeDoc[]> => {
  const [articles, faqs, departments, doctors, packages, policy, site] = await Promise.all([
    // Chỉ bài đã xuất bản (đã có người duyệt nội dung chuyên môn) mới thành tri thức của chatbot.
    prisma.article.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, slug: true, title: true, summary: true, content: true, department: { select: { name: true } } },
      take: 300,
    }),
    FAQService.listForChatbot(),
    prisma.department.findMany({
      where: { isActive: true },
      select: { id: true, name: true, slug: true, description: true, triageDescription: true, symptomKeywords: true },
      take: 200,
    }),
    prisma.doctorProfile.findMany({
      where: { isAvailable: true, user: { isActive: true } },
      select: {
        id: true,
        slug: true,
        title: true,
        specialization: true,
        bio: true,
        experience: true,
        consultationFee: true,
        user: { select: { fullName: true } },
        department: { select: { name: true } },
      },
      take: 500,
    }),
    prisma.package.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        summary: true,
        description: true,
        note: true,
        basePrice: true,
        serviceFee: true,
        isBHYTSupport: true,
        department: { select: { name: true } },
        items: { select: { name: true, included: true }, orderBy: { order: "asc" } },
      },
      take: 500,
    }),
    PolicyService.get(),
    SiteSettingsService.get(),
  ]);

  const siteValue = site.value as Parameters<typeof siteDoc>[0];
  const siteInfo = siteDoc(siteValue && typeof siteValue === "object" ? siteValue : {});
  return [
    ...faqs.map(faqDoc),
    ...departments.map(departmentDoc),
    ...doctors.map(doctorDoc),
    ...packages.map(packageDoc),
    ...articles.flatMap(articleDocs),
    policyDoc(policy),
    ...(siteInfo ? [siteInfo] : []),
  ];
};
