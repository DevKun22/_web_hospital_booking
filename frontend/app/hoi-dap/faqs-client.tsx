"use client";

import { CalendarCheck, ChevronRight, CircleHelp, Info, MessageCircle, Phone, Receipt, Route, Search, ShieldCheck, Stethoscope, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CatalogHeader, CatalogStatusBar, ChatbotHint, FilterChip } from "@/components/public/catalog-parts";
import { HighlightText } from "@/components/public/search-highlight";
import { openPublicChatbot } from "@/lib/public-ui-events";
import type { PublicFAQ } from "@/lib/types";

const categoryLabels: Record<string, string> = {
  booking: "Đặt lịch và lịch hẹn",
  payment: "Chi phí và thanh toán",
  doctor: "Bác sĩ và chuyên khoa",
  insurance: "BHYT",
  general: "Thông tin chung",
};

const categoryIcons: Record<string, LucideIcon> = {
  booking: CalendarCheck,
  payment: Receipt,
  doctor: Stethoscope,
  insurance: ShieldCheck,
  general: Info,
};

const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const categoryLabel = (category: string | null) => categoryLabels[category || "general"] || category || "Thông tin chung";

export function FAQsClient({
  initialFAQs,
  initialCategory = "",
  hotline = "",
}: {
  initialFAQs: PublicFAQ[];
  initialCategory?: string;
  hotline?: string;
}) {
  const [category, setCategory] = useState(initialCategory);
  const [search, setSearch] = useState("");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());

  const categories = useMemo(() => {
    const keys = new Set(initialFAQs.map((item) => item.category || "general"));
    return Array.from(keys).sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b), "vi"));
  }, [initialFAQs]);

  const keyword = search.trim();
  const visible = useMemo(() => {
    const needle = normalize(keyword);
    return initialFAQs.filter((item) => {
      const matchesCategory = !category || (item.category || "general") === category;
      return matchesCategory && (!needle || normalize(`${item.question} ${item.answer}`).includes(needle));
    });
  }, [category, initialFAQs, keyword]);

  // Liên kết thẳng tới một câu (#faq-MÃ): mở câu đó và cuộn tới, lúc tải trang và khi đổi phần neo ngay trên trang.
  useEffect(() => {
    const openFromHash = () => {
      const match = window.location.hash.match(/^#faq-(.+)$/);
      if (!match || !initialFAQs.some((item) => item.id === match[1])) return;
      const id = match[1];
      setSearch("");
      setCategory("");
      setOpenIds(new Set([id]));
      window.setTimeout(() => document.getElementById(`faq-${id}`)?.scrollIntoView({ block: "center" }), 50);
    };
    const timer = window.setTimeout(openFromHash, 0);
    window.addEventListener("hashchange", openFromHash);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", openFromHash);
    };
  }, [initialFAQs]);

  const toggle = (id: string) =>
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allOpen = visible.length > 0 && visible.every((item) => openIds.has(item.id));
  const toggleAll = () => setOpenIds(allOpen ? new Set() : new Set(visible.map((item) => item.id)));

  // Ở Tất cả, câu hỏi nhóm theo chủ đề; chọn một chủ đề thì chỉ còn một danh sách.
  const groups = useMemo(() => {
    const keys = category ? [category] : categories;
    return keys
      .map((key) => ({ key, items: visible.filter((item) => (item.category || "general") === key) }))
      .filter((group) => group.items.length);
  }, [category, categories, visible]);

  const renderItem = (item: PublicFAQ) => {
    const expanded = openIds.has(item.id);
    return (
      <li key={item.id} id={`faq-${item.id}`} className={`scroll-mt-36 transition-colors ${expanded ? "bg-[var(--public-primary-soft)]" : ""}`}>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={`faq-answer-${item.id}`}
          onClick={() => toggle(item.id)}
          className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left text-base font-semibold hover:bg-[var(--public-surface-muted)]"
        >
          <span className="min-w-0 flex-1 leading-6"><HighlightText text={item.question} query={keyword} /></span>
          <ChevronRight className={`h-4 w-4 shrink-0 text-[var(--public-muted)] transition-transform motion-reduce:transition-none ${expanded ? "rotate-90" : ""}`} aria-hidden="true" />
        </button>
        <div
          id={`faq-answer-${item.id}`}
          aria-hidden={!expanded}
          className={`grid transition-[grid-template-rows,visibility] duration-200 motion-reduce:transition-none ${expanded ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]"}`}
        >
          <div className="overflow-hidden">
            <p className="px-4 pb-4 text-base leading-7 text-[var(--public-text-soft)]"><HighlightText text={item.answer} query={keyword} /></p>
          </div>
        </div>
      </li>
    );
  };

  return (
    <main className="min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">
      <CatalogHeader brand current="Hỏi đáp" title="Câu hỏi thường gặp" description="Giải đáp về đặt lịch, chi phí, bác sĩ và bảo hiểm. Không thấy điều cần biết thì hỏi trợ lý hoặc xem hướng dẫn đặt lịch.">
        <div role="search" className="flex min-h-12 max-w-xl items-center gap-2 rounded-full border border-[var(--public-border)] bg-[var(--public-surface)] px-4 focus-within:border-[var(--public-primary)]">
          <Search className="h-5 w-5 shrink-0 text-[var(--public-muted)]" aria-hidden="true" />
          <label htmlFor="help-search" className="sr-only">Tìm câu hỏi</label>
          <input
            id="help-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm câu hỏi"
            className="min-w-0 flex-1 border-0 bg-transparent py-2 text-base"
            style={{ outline: "none", boxShadow: "none" }}
          />
        </div>
      </CatalogHeader>

      <CatalogStatusBar
        status={`${visible.length} câu hỏi`}
        chips={[
          ...(keyword ? [{ key: "q", label: `“${keyword}”`, onRemove: () => setSearch("") }] : []),
          ...(category ? [{ key: "category", label: categoryLabel(category), onRemove: () => setCategory("") }] : []),
        ]}
        onReset={() => {
          setSearch("");
          setCategory("");
        }}
        extra={visible.length > 1 ? <button type="button" onClick={toggleAll} className="inline-flex min-h-8 items-center text-sm font-medium text-[var(--public-primary)] underline underline-offset-4">{allOpen ? "Thu gọn tất cả" : "Mở tất cả"}</button> : null}
      />

      <section className="ui-container py-6 sm:py-8">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Chủ đề">
          <FilterChip selected={!category} onClick={() => setCategory("")}>Tất cả</FilterChip>
          {categories.map((key) => (
            <FilterChip key={key} selected={category === key} onClick={() => setCategory(key)}>{categoryLabel(key)}</FilterChip>
          ))}
        </div>

        {visible.length ? (
          <div className="mt-5 space-y-6">
            {groups.map((group) => {
              const Icon = categoryIcons[group.key] || CircleHelp;
              return (
                <section key={group.key} aria-labelledby={`faq-group-${group.key}`}>
                  {!category ? (
                    <h2 id={`faq-group-${group.key}`} className="mb-2 flex items-center gap-2 text-base font-semibold">
                      <Icon className="h-4 w-4 text-[var(--public-primary)]" aria-hidden="true" />
                      {categoryLabel(group.key)} · {group.items.length}
                    </h2>
                  ) : null}
                  <ul className="divide-y divide-[var(--public-divider)] overflow-hidden rounded-lg border border-[var(--public-border)] bg-[var(--public-surface)]">
                    {group.items.map(renderItem)}
                  </ul>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-dashed border-[var(--public-border)] p-6 text-center text-sm text-[var(--public-muted)]">
            <p>{initialFAQs.length ? "Chưa có câu trả lời khớp. Thử từ khóa ngắn hơn hoặc hỏi trợ lý bên dưới." : "Các câu hỏi thường gặp sẽ sớm được cập nhật. Trong lúc chờ, bạn có thể hỏi trợ lý hoặc xem hướng dẫn đặt lịch."}</p>
          </div>
        )}

        <div className="mt-8">
          <p className="text-sm font-semibold text-[var(--public-ink)]">Chưa tìm thấy điều cần biết?</p>
          <ul className={`mt-3 grid gap-3 ${hotline ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            <li>
              <button type="button" onClick={() => openPublicChatbot()} className="flex w-full items-center gap-3 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-3 text-left text-sm font-semibold transition hover:border-[var(--public-primary)]">
                <MessageCircle className="h-5 w-5 shrink-0 text-[var(--public-primary)]" aria-hidden="true" />Hỏi Kun
              </button>
            </li>
            <li>
              <Link href="/huong-dan/dat-lich" className="flex items-center gap-3 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-3 text-sm font-semibold transition hover:border-[var(--public-primary)]">
                <Route className="h-5 w-5 shrink-0 text-[var(--public-primary)]" aria-hidden="true" />Hướng dẫn đặt lịch
              </Link>
            </li>
            {hotline ? (
              <li>
                <a href={`tel:${hotline}`} className="flex items-center gap-3 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-3 text-sm font-semibold tabular-nums transition hover:border-[var(--public-primary)]">
                  <Phone className="h-5 w-5 shrink-0 text-[var(--public-primary)]" aria-hidden="true" />{hotline}
                </a>
              </li>
            ) : null}
          </ul>
        </div>
        <ChatbotHint>Muốn được định hướng chuyên khoa hoặc gói khám?</ChatbotHint>
      </section>
    </main>
  );
}
