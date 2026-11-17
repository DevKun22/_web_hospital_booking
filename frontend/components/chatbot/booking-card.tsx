import { ArrowRight } from "lucide-react";
import { formatChatbotDate } from "@/lib/chatbot-ui";
import { formatCurrency } from "@/lib/format";
import type { ChatbotDraftSummary } from "@/lib/types";

// Khi đã có bác sĩ và khung giờ: thẻ "Lịch của bạn" gọn hai dòng với một nút chính duy nhất sang trang đặt lịch
// (nhập thông tin người khám và xác thực OTP ở đó, không nhập trong khung chat). Gọn để khung tin nhắn vẫn đủ chỗ.
export function BookingCard({ summary, onContinue }: { summary?: ChatbotDraftSummary; onContinue: () => void }) {
  if (!summary?.doctor || !summary.slot) return null;
  const { doctor, slot } = summary;

  return (
    <section className="kun-rise mx-3 mb-2 rounded-xl border border-[var(--public-primary)] bg-white p-2.5" aria-label="Lịch của bạn">
      <p className="truncate text-sm font-semibold text-[var(--public-ink)]">
        {doctor.name} · {slot.startTime}, {formatChatbotDate(slot.date)}
      </p>
      <p className="truncate text-xs text-[var(--public-text-soft)]">
        {doctor.departmentName} · Phí khám {formatCurrency(doctor.fee)}
      </p>
      <button
        type="button"
        onClick={onContinue}
        className="public-button-primary mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-white"
      >
        Nhập thông tin và xác thực OTP
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </section>
  );
}
