"use client";

import { HelpCircle, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PublicPageHero } from "@/components/public/public-page-layout";
import { usePublicFAQs } from "@/lib/public-faq-query";
import type { PublicFAQ } from "@/lib/types";

const categories = [
  { value: "", label: "Tất cả" },
  { value: "booking", label: "Đặt lịch" },
  { value: "payment", label: "Thanh toán" },
  { value: "doctor", label: "Bác sĩ" },
  { value: "insurance", label: "BHYT" },
  { value: "general", label: "Chung" },
];

export function FAQsClient({ initialFAQs, initialCategory = "" }: { initialFAQs: PublicFAQ[]; initialCategory?: string }) {
  const [category, setCategory] = useState(initialCategory);
  const [search, setSearch] = useState("");
  const faqsQuery = usePublicFAQs(category, initialFAQs, initialCategory);
  const faqs = useMemo(() => faqsQuery.data || [], [faqsQuery.data]);
  const loading = faqsQuery.isLoading;
  const error = faqsQuery.error instanceof Error ? faqsQuery.error.message : "";

  const visibleFAQs = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return faqs;

    return faqs.filter((item) =>
      `${item.question} ${item.answer} ${item.category || ""}`.toLowerCase().includes(keyword),
    );
  }, [faqs, search]);

  return (
    <main className="min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">
      <PublicPageHero
        eyebrow="Hỏi đáp"
        title="Câu hỏi thường gặp"
        description="Tìm nhanh các câu hỏi về đặt lịch, bác sĩ, thanh toán, bảo hiểm và quy trình khám."
      >
          <div className="public-filter-panel grid max-w-5xl gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--public-muted)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm theo câu hỏi hoặc nội dung trả lời"
                className="ui-field w-full py-3 pl-10 pr-3 text-sm"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((item) => (
                <button
                  key={item.value || "all"}
                  type="button"
                  onClick={() => setCategory(item.value)}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    category === item.value
                      ? "border-[var(--public-primary)] bg-[var(--public-primary-soft)] text-[var(--public-primary-dark)]"
                      : "border-[var(--public-border)] bg-white text-[var(--public-text-soft)] hover:border-[var(--public-primary)]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
      </PublicPageHero>

      <section className="ui-container grid gap-6 py-10 sm:py-12 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          {error ? <div className="mb-4 rounded-md border border-[#f2b8b5] bg-[#fff3f2] px-4 py-3 text-sm text-[#b3261e]">{error}</div> : null}
          <p className="mb-4 text-sm font-medium text-[var(--public-muted)]">{loading ? "Đang tải câu hỏi..." : `${visibleFAQs.length} câu hỏi đang hiển thị`}</p>

          <div className="space-y-3">
            {loading ? Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="rounded-md border border-[#dce3ee] bg-white p-4">
                <span className="skeleton-shimmer block h-5 w-3/4 rounded-md" />
                <span className="skeleton-shimmer mt-4 block h-4 w-full rounded-md" />
                <span className="skeleton-shimmer mt-2 block h-4 w-5/6 rounded-md" />
              </div>
            )) : visibleFAQs.length ? visibleFAQs.map((item) => (
              <details key={item.id} className="rounded-2xl border border-[var(--public-border)] bg-white p-5 shadow-sm transition hover:border-[var(--public-primary)]">
                <summary className="cursor-pointer font-semibold">{item.question}</summary>
                <p className="mt-3 text-sm leading-7 text-[var(--public-muted)]">{item.answer}</p>
                {item.category ? <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">{item.category}</p> : null}
              </details>
            )) : (
              <div className="rounded-md border border-dashed border-[#dce3ee] bg-white p-8 text-center text-sm text-[#667892]">
                Chưa tìm thấy câu hỏi phù hợp.
              </div>
            )}
          </div>
        </div>

        <aside className="h-fit rounded-2xl border border-[var(--public-border)] bg-white p-5 shadow-sm lg:sticky lg:top-28">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#172033]">
            <HelpCircle className="h-4 w-4 text-[var(--public-primary)]" />
            Cần thao tác nhanh?
          </div>
          <div className="mt-4 space-y-2">
            <Link href="/#booking" className="public-button-primary block rounded-xl px-4 py-3 text-center text-sm font-semibold">
              Đặt lịch khám
            </Link>
            <Link href="/appointments/lookup" className="public-button-secondary block rounded-xl px-4 py-3 text-center text-sm font-semibold">
              Tra cứu lịch hẹn
            </Link>
            <Link href="/guide/booking" className="public-button-secondary block rounded-xl px-4 py-3 text-center text-sm font-semibold">
              Xem hướng dẫn đặt lịch
            </Link>
          </div>
        </aside>
      </section>
    </main>
  );
}
