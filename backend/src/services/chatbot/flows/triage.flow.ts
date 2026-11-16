import { prisma } from "../../../config/prisma.js";
import type { NLUResult } from "../ai/nlu.schema.js";
import type { ChatBookingDraft } from "../chatbot.types.js";
import KnowledgeService from "../rag/knowledge.service.js";
import { composeTriageReply } from "../rag/generator.js";

// Gợi ý chuyên khoa theo triệu chứng: truy hồi trong các đoạn tri thức của chuyên khoa (mô tả, triệu chứng thường gặp),
// lấy chuyên khoa khớp nhất; không khớp thì dùng chuyên khoa được đánh dấu "đánh giá ban đầu". AI chỉ diễn đạt lại, không chọn khoa.

export type TriageRecommendation = {
  departmentId: string;
  departmentName: string;
  departmentSlug: string | null;
  description: string | null;
  triageDescription: string | null;
  confidence: number;
  matched: boolean;
  fallback: boolean;
};

const departmentSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  triageDescription: true,
} as const;

const symptomQuery = (draft: ChatBookingDraft) =>
  [...(draft.symptoms || []), ...(draft.bodyParts || []), ...(draft.associatedSymptoms || []), draft.symptomDuration]
    .filter(Boolean)
    .join(" ")
    .trim();

const toRecommendation = (
  department: { id: string; name: string; slug: string | null; description: string | null; triageDescription: string | null },
  extra: { confidence: number; matched: boolean },
): TriageRecommendation => ({
  departmentId: department.id,
  departmentName: department.name,
  departmentSlug: department.slug,
  description: department.description,
  triageDescription: department.triageDescription,
  confidence: extra.confidence,
  matched: extra.matched,
  fallback: !extra.matched,
});

class TriageFlow {
  async recommend(draft: ChatBookingDraft): Promise<TriageRecommendation | null> {
    const query = symptomQuery(draft);
    if (!query) return null;

    const hits = await KnowledgeService.retrieve(query, { types: ["DEPARTMENT"], limit: 3 });
    for (const hit of hits) {
      const department = await prisma.department.findFirst({
        where: { id: hit.chunk.sourceId, isActive: true, isTriageFallback: false },
        select: departmentSelect,
      });
      if (!department) continue;
      const strength = Math.max(hit.coverage, hit.similarity ?? 0);
      return toRecommendation(department, { confidence: Math.min(0.95, Math.max(0.58, 0.5 + strength * 0.45)), matched: true });
    }

    const fallback = await prisma.department.findFirst({
      where: { isActive: true, isTriageFallback: true },
      select: departmentSelect,
    });
    return fallback ? toRecommendation(fallback, { confidence: 0.45, matched: false }) : null;
  }

  composeReply(input: {
    userMessage: string;
    nlu: NLUResult;
    recommendation: TriageRecommendation;
    fallbackReply: string;
    model?: string;
  }) {
    const { recommendation, nlu } = input;
    return composeTriageReply({
      userMessage: input.userMessage,
      departmentName: recommendation.departmentName,
      fallbackReply: input.fallbackReply,
      model: input.model,
      verifiedData: {
        department: { name: recommendation.departmentName, description: recommendation.triageDescription || recommendation.description },
        matched: recommendation.matched,
        fallback: recommendation.fallback,
        symptoms: nlu.entities.symptoms,
        bodyParts: nlu.entities.bodyParts,
        duration: nlu.entities.duration,
        severity: nlu.entities.severity,
        associatedSymptoms: nlu.entities.associatedSymptoms,
      },
    });
  }
}

export default new TriageFlow();
