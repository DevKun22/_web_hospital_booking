import FAQService from "../../faq.service.js";
import type { ChatIntent } from "../chatbot.types.js";
import { foldVietnamese, hasPhrase } from "../rules/text-normalizer.js";

export type ChatbotFAQMatch = {
  faq: {
    question: string;
    answer: string;
    keywords: string[];
  };
  intent: ChatIntent;
  confidence: number;
};

type FAQCandidate = {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
};

const faqStopwords = new Set([
  "ban",
  "toi",
  "minh",
  "duoc",
  "khong",
  "nao",
  "gi",
  "vay",
  "dang",
  "hien",
  "tai",
  "co",
  "the",
  "la",
  "va",
  "mot",
  "cac",
  "cho",
  "nhu",
  "lam",
]);

const meaningfulTokens = (value: string) =>
  new Set(
    (foldVietnamese(value).match(/[a-z0-9]+/g) || []).filter(
      (token) => token.length >= 3 && !faqStopwords.has(token),
    ),
  );

const countOverlap = (source: Set<string>, candidate: Set<string>) =>
  Array.from(source).filter((token) => candidate.has(token)).length;

const scoreCandidate = (
  message: string,
  faq: FAQCandidate,
  searchScore = 0,
) => {
  const foldedMessage = foldVietnamese(message);
  const messageTokens = meaningfulTokens(message);
  const questionTokens = meaningfulTokens(faq.question);
  const keywordTokens = meaningfulTokens(faq.keywords.join(" "));
  const answerTokens = meaningfulTokens(faq.answer);
  const querySize = Math.max(messageTokens.size, 1);

  // Curated FAQ keywords are the strongest signal. Token overlap still covers
  // natural paraphrases that administrators did not list explicitly.
  const keywordPhraseMatch = faq.keywords.some((keyword) => {
    const foldedKeyword = foldVietnamese(keyword);
    return foldedKeyword.length >= 2 && hasPhrase(foldedMessage, foldedKeyword);
  });
  const questionOverlap = countOverlap(messageTokens, questionTokens);
  const keywordOverlap = countOverlap(messageTokens, keywordTokens);
  const answerOverlap = countOverlap(messageTokens, answerTokens);
  const strongQuestionMatch =
    messageTokens.size === 1
      ? questionOverlap === 1
      : questionOverlap >= 2 && questionOverlap / querySize >= 0.4;
  const strongKeywordMatch =
    messageTokens.size === 1
      ? keywordOverlap === 1
      : keywordOverlap >= 2 && keywordOverlap / querySize >= 0.4;

  return {
    relevant: keywordPhraseMatch || strongQuestionMatch || strongKeywordMatch,
    score:
      (keywordPhraseMatch ? 8 : 0) +
      (questionOverlap / querySize) * 4 +
      (keywordOverlap / querySize) * 3 +
      (answerOverlap / querySize) +
      Math.min(Math.max(searchScore, 0), 30) / 30,
  };
};

class ChatbotFAQRepository {
  async findDirectAnswer(
    message: string,
    detectedIntent: ChatIntent,
  ): Promise<ChatbotFAQMatch | null> {
    const faqs = await FAQService.listForChatbot();

    const best = faqs
      .map((faq) => {
        return {
          faq,
          ...scoreCandidate(message, faq),
        };
      })
      .filter((candidate) => candidate.relevant)
      .sort((a, b) => b.score - a.score)[0];

    if (!best) return null;

    return {
      faq: best.faq,
      intent:
        detectedIntent === "UNKNOWN"
          ? "GENERAL_HOSPITAL_INFO"
          : detectedIntent,
      confidence: Math.min(0.95, Math.max(0.68, best.score / 12)),
    };
  }
}

export default new ChatbotFAQRepository();
