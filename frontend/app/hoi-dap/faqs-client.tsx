"use client";

import { ChevronRight, Phone, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CatalogHeader, ChatbotHint, FilterChip, RowList } from "@/components/public/catalog-parts";
import type { PublicFAQ } from "@/lib/types";

const categoryLabels: Record<string, string> = {
  booking: "Đặt lịch và lịch hẹn",
  payment: "Chi phí và thanh toán",
  doctor: "Bác sĩ và chuyên khoa",
  insurance: "BHYT",
  general: "Thông tin chung",
};

const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const categoryLabel = (category: string | null) => categoryLabels[category || "general"] || category || "Thông tin chung";

export function FAQsClient({
  initialFAQs,
  initialCategory = "",
  hotline = "1900 0000",
}: {
  initialFAQs: PublicFAQ[];
  initialCategory?: string;
  hotline?: string;
}) {
  const [category, setCategory] = useState(initialCategory);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const keys = new Set(initialFAQs.map((item) => item.category || "general"));
    return Array.from(keys).sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b), "vi"));
  }, [initialFAQs]);

  const visible = useMemo(() => {
    const keyword = normalize(search.trim());
    return initialFAQs.filter((item) => {
      const matchesCategory = !category || (item.category || "general") === category;
      return matchesCategory && (!keyword || normalize(`${item.question} ${item.answer}`).includes(keyword));
    });
  }, [category, initialFAQs, search]);

  return (
    <main className="min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">
      <CatalogHeader current="Hỏi đáp" title="Câu hỏi thường gặp" description="Giải đáp về đặt lịch, chi phí, bác sĩ và bảo hiểm. Không thấy điều cần biết thì gọi hotline hoặc hỏi trợ lý.">
        <div role="search" className="flex min-h-12 max-w-xl items-center gap-2 rounded-lg border border-[var(--public-border)] bg-[var(--public-surface)] px-3 focus-within:border-[var(--public-primary)]">
          <Search className="h-5 w-5 shrink-0 text-[var(--public-muted)]" aria-hidden="true" />
          <label htmlFor="help-search" className="sr-only">Tìm câu hỏi</label>
          <input
            id="help-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ví dụ: OTP, BHYT, hủy lịch"
            className="min-w-0 flex-1 border-0 bg-transparent py-2 text-base"
            style={{ outline: "none", boxShadow: "none" }}
          />
        </div>
      </CatalogHeader>

      <section className="ui-container py-6 sm:py-8">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Chủ đề">
          <FilterChip selected={!category} onClick={() => setCategory("")}>Tất cả</FilterChip>
          {categories.map((key) => (
            <FilterChip key={key} selected={category === key} onClick={() => setCategory(key)}>{categoryLabel(key)}</FilterChip>
          ))}
        </div>

        <p className="mt-4 text-sm text-[var(--public-muted)]" aria-live="polite">{visible.length} câu hỏi</p>

        {visible.length ? (
          <div className="mt-3">
            <RowList>
              {visible.map((item) => {
                const expanded = expandedId === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={`faq-answer-${item.id}`}
                      onClick={() => setExpandedId(expanded ? null : item.id)}
                      className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left text-base font-semibold hover:bg-[var(--public-surface-muted)]"
                    >
                      <span className="min-w-0 flex-1 leading-6">{item.question}</span>
                      <ChevronRight className={`h-4 w-4 shrink-0 text-[var(--public-muted)] transition-transform ${expanded ? "rotate-90" : ""}`} aria-hidden="true" />
                    </button>
                    {expanded ? (
                      <div id={`faq-answer-${item.id}`} className="px-4 pb-4 text-base leading-7 text-[var(--public-text-soft)]">
                        <p>{item.answer}</p>
                        <p className="mt-2 text-sm text-[var(--public-muted)]">{categoryLabel(item.category)}</p>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </RowList>
          </div>
        ) : (
          <p className="mt-3 rounded-lg border border-dashed border-[var(--public-border)] p-6 text-center text-sm text-[var(--public-muted)]">Chưa có câu trả lời khớp. Thử từ khóa ngắn hơn hoặc hỏi trợ lý bên dưới.</p>
        )}

        <div className="mt-8 flex flex-col gap-1 text-base text-[var(--public-text-soft)]">
          <p>
            Cần hỗ trợ trực tiếp?{" "}
            <a href={`tel:${hotline}`} className="inline-flex items-center gap-1.5 font-semibold text-[var(--public-primary)] underline underline-offset-4">
              <Phone className="h-4 w-4" aria-hidden="true" />{hotline}
            </a>
          </p>
          <p>
            Chưa rõ cách đặt lịch? Xem{" "}
            <Link href="/huong-dan/dat-lich" className="font-semibold text-[var(--public-primary)] underline underline-offset-4">hướng dẫn đặt lịch</Link>.
          </p>
        </div>
        <ChatbotHint>Muốn được định hướng chuyên khoa hoặc gói khám?</ChatbotHint>
      </section>
    </main>
  );
}
