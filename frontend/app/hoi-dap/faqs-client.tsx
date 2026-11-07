"use client";

import {
  ArrowRight,
  Bot,
  CalendarCheck,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Headphones,
  ListFilter,
  MessageCircleQuestion,
  Phone,
  Search,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { openPublicChatbot } from "@/lib/public-ui-events";
import type { PublicFAQ } from "@/lib/types";

const categoryMeta: Record<string, { label: string; description: string }> = {
  booking: { label: "Đặt lịch và lịch hẹn", description: "Chọn dịch vụ, xác thực OTP, đổi hoặc hủy lịch." },
  payment: { label: "Chi phí và thanh toán", description: "Phí dự kiến, hóa đơn và phương thức thanh toán." },
  doctor: { label: "Bác sĩ và chuyên khoa", description: "Tìm bác sĩ, chuyên khoa và lịch tiếp nhận." },
  insurance: { label: "BHYT", description: "Thông tin BHYT được công bố trong hệ thống." },
  general: { label: "Thông tin chung", description: "Các câu hỏi chung khi sử dụng dịch vụ." },
};

const quickSearches = ["đặt lịch", "OTP", "BHYT", "thanh toán", "hủy lịch"];
const bookingSteps = [
  { title: "Chọn dịch vụ", description: "Chọn chuyên khoa, bác sĩ hoặc gói khám phù hợp.", icon: Stethoscope },
  { title: "Chọn thời gian", description: "Xem ngày và khung giờ còn tiếp nhận từ dữ liệu hệ thống.", icon: CalendarCheck },
  { title: "Điền thông tin", description: "Cung cấp thông tin người khám và lý do khám cần thiết.", icon: ClipboardCheck },
  { title: "Xác thực OTP", description: "Xác nhận số điện thoại hoặc email để hoàn tất yêu cầu.", icon: ShieldCheck },
];

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const categoryLabel = (category: string | null) =>
  categoryMeta[category || "general"]?.label || category || "Thông tin chung";

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
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);

  const categoryOptions = useMemo(() => {
    const counts = new Map<string, number>();
    initialFAQs.forEach((item) => {
      const key = item.category || "general";
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count, label: categoryLabel(value) }))
      .sort((a, b) => a.label.localeCompare(b.label, "vi"));
  }, [initialFAQs]);

  const visibleFAQs = useMemo(() => {
    const keyword = normalize(search.trim());
    return initialFAQs.filter((item) => {
      const matchesCategory = !category || (item.category || "general") === category;
      const matchesKeyword = !keyword || normalize(`${item.question} ${item.answer} ${categoryLabel(item.category)}`).includes(keyword);
      return matchesCategory && matchesKeyword;
    });
  }, [category, initialFAQs, search]);

  const groupedFAQs = useMemo(() => {
    const groups = new Map<string, PublicFAQ[]>();
    visibleFAQs.forEach((item) => {
      const key = item.category || "general";
      groups.set(key, [...(groups.get(key) || []), item]);
    });
    return Array.from(groups.entries());
  }, [visibleFAQs]);

  const searchSuggestions = search.trim() ? visibleFAQs.slice(0, 4) : [];

  const scrollToFAQs = () => document.getElementById("danh-sach-cau-hoi")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const chooseQuickSearch = (value: string) => {
    setCategory("");
    setSearch(value);
    window.setTimeout(scrollToFAQs, 0);
  };

  const openSearchResult = (id: string) => {
    setExpandedFaqId(id);
    window.setTimeout(() => {
      document.getElementById(`faq-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  };

  return (
    <main className="min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">
      <section className="border-b border-[var(--public-border)] bg-[linear-gradient(180deg,#eef4ff_0%,#f8faff_100%)]">
        <div className="ui-container py-8 text-center sm:py-11 lg:py-14">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#cddcff] bg-white px-3 py-1.5 text-xs font-bold text-[#1749bd] shadow-sm">
            <CircleHelp className="h-4 w-4" aria-hidden="true" /> Trung tâm hỗ trợ người khám
          </div>
          <h1 className="mx-auto mt-4 max-w-4xl text-balance text-3xl font-bold tracking-[-0.035em] text-[#102343] sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
            Hướng dẫn và giải đáp trong một nơi
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[var(--public-muted)] sm:text-base sm:leading-7">
            Tìm câu trả lời theo dữ liệu đang được quản trị, xem quy trình đặt lịch và kết nối đúng kênh hỗ trợ khi cần.
          </p>
          <div className="mx-auto mt-7 max-w-3xl">
            <label htmlFor="help-search" className="sr-only">Tìm câu hỏi hoặc hướng dẫn</label>
            <div className="flex min-h-14 items-center rounded-2xl border border-[#cdd9ef] bg-white p-1.5 shadow-[0_12px_30px_rgba(30,64,175,0.10)] focus-within:border-[#2563eb] focus-within:ring-4 focus-within:ring-[#dbeafe]">
              <Search className="ml-3 h-5 w-5 shrink-0 text-[#52709f]" aria-hidden="true" />
              <input
                id="help-search"
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setCategory("");
                }}
                placeholder="Nhập câu hỏi, ví dụ: OTP, BHYT, hủy lịch..."
                className="min-w-0 flex-1 border-0 bg-transparent px-3 py-3 text-base text-[#102343] placeholder:text-[#7a8ca8]"
                style={{ outline: "none", boxShadow: "none" }}
              />
              <button type="button" onClick={scrollToFAQs} className="hidden min-h-11 shrink-0 items-center gap-2 rounded-xl bg-[#2563eb] px-5 text-sm font-bold text-white transition hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 sm:inline-flex">
                Tìm kiếm <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {search.trim() ? (
              <div className="mt-2 overflow-hidden rounded-2xl border border-[#cdd9ef] bg-white text-left shadow-[0_14px_34px_rgba(30,64,175,0.12)]">
                <div className="flex items-center justify-between border-b border-[var(--public-divider)] px-4 py-2.5">
                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#52709f]">Kết quả phù hợp</p>
                  <span className="text-xs font-semibold text-[var(--public-muted)]">{visibleFAQs.length} kết quả</span>
                </div>
                {searchSuggestions.length ? (
                  <div className="divide-y divide-[var(--public-divider)]">
                    {searchSuggestions.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openSearchResult(item.id)}
                        className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-[#f3f7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563eb]"
                      >
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e7f0ff] text-[#2563eb]"><CircleHelp className="h-4 w-4" aria-hidden="true" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold leading-5 text-[#102343]">{item.question}</span>
                          <span className="mt-0.5 block truncate text-xs text-[var(--public-muted)]">{categoryLabel(item.category)} · {item.answer}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-[#52709f]" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-5 text-center text-sm text-[var(--public-muted)]">Chưa có câu trả lời khớp từ khóa này.</div>
                )}
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2" aria-label="Từ khóa gợi ý">
              <span className="text-xs font-semibold text-[var(--public-muted)]">Tìm nhanh:</span>
              {quickSearches.map((item) => (
                <button key={item} type="button" onClick={() => chooseQuickSearch(item)} className="min-h-8 rounded-full border border-[var(--public-border)] bg-white px-3 text-xs font-semibold text-[var(--public-text-soft)] transition hover:border-[#2563eb] hover:text-[#1749bd]">{item}</button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="danh-sach-cau-hoi" className="scroll-mt-28 border-y border-[var(--public-border)] bg-[#f3f6fc]">
        <div className="ui-container grid gap-6 py-10 lg:grid-cols-[260px_minmax(0,1fr)] lg:py-14">
          <aside className="h-fit rounded-2xl border border-[var(--public-border)] bg-white p-3 shadow-sm lg:sticky lg:top-28">
            <div className="flex items-center gap-2 border-b border-[var(--public-divider)] px-3 pb-3 pt-2 text-sm font-bold text-[#102343]"><ListFilter className="h-4 w-4 text-[#2563eb]" aria-hidden="true" /> Chủ đề giải đáp</div>
            <div className="mt-2 space-y-1">
              <CategoryButton active={!category} label="Tất cả câu hỏi" count={initialFAQs.length} onClick={() => setCategory("")} />
              {categoryOptions.map((item) => <CategoryButton key={item.value} active={category === item.value} label={item.label} count={item.count} onClick={() => setCategory(item.value)} />)}
            </div>
            <div className="mt-4 rounded-xl bg-[#e9f0ff] p-4">
              <Headphones className="h-5 w-5 text-[#2563eb]" aria-hidden="true" />
              <p className="mt-3 text-sm font-bold text-[#102343]">Cần hỗ trợ trực tiếp?</p>
              <p className="mt-1 text-xs leading-5 text-[var(--public-muted)]">Liên hệ số hotline được cấu hình bởi bệnh viện.</p>
              <a href={`tel:${hotline}`} className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#2563eb] px-3 text-sm font-bold text-white"><Phone className="h-4 w-4" aria-hidden="true" /> {hotline}</a>
            </div>
          </aside>

          <div className="min-w-0">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2563eb]">Giải đáp theo dữ liệu hệ thống</p><h2 className="mt-2 text-2xl font-bold tracking-[-0.025em] text-[#102343]">{category ? categoryLabel(category) : "Tất cả câu hỏi"}</h2></div>
              <p className="text-sm font-semibold text-[var(--public-muted)]" aria-live="polite">{visibleFAQs.length} kết quả</p>
            </div>
            {groupedFAQs.length ? (
              <div className="space-y-7">
                {groupedFAQs.map(([group, items]) => (
                  <section key={group} aria-labelledby={`faq-group-${group}`}>
                    {!category ? <div className="mb-3 flex items-start justify-between gap-3"><div><h3 id={`faq-group-${group}`} className="text-lg font-bold text-[#102343]">{categoryLabel(group)}</h3><p className="mt-1 text-xs leading-5 text-[var(--public-muted)]">{categoryMeta[group]?.description || "Thông tin hỗ trợ đang được công bố."}</p></div><span className="shrink-0 rounded-full bg-[#e7f0ff] px-2.5 py-1 text-xs font-bold text-[#1749bd]">{items.length} câu</span></div> : null}
                    <div className="space-y-2">{items.map((item, index) => <FAQItem key={item.id} item={item} index={index} expanded={expandedFaqId === item.id} onToggle={() => setExpandedFaqId((current) => current === item.id ? null : item.id)} />)}</div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#b9c8df] bg-white p-8 text-center">
                <MessageCircleQuestion className="mx-auto h-7 w-7 text-[#2563eb]" aria-hidden="true" /><h3 className="mt-3 font-bold text-[#102343]">Chưa tìm thấy câu trả lời phù hợp</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--public-muted)]">Thử từ khóa ngắn hơn hoặc kết nối với trợ lý để được định hướng đến dịch vụ phù hợp.</p><button type="button" onClick={openPublicChatbot} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#2563eb] px-5 text-sm font-bold text-white"><Bot className="h-4 w-4" aria-hidden="true" /> Mở trợ lý</button>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="ui-container py-10 sm:py-14">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2563eb]">Quy trình đặt lịch</p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.025em] text-[#102343]">Bốn bước rõ ràng, không nhập dồn thông tin</h2>
          </div>
          <Link href="/huong-dan/dat-lich" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#1749bd]">Xem hướng dẫn chi tiết <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {bookingSteps.map((step, index) => {
            const Icon = step.icon;
            return <article key={step.title} className="rounded-2xl border border-[var(--public-border)] bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#e7f0ff] text-[#2563eb]"><Icon className="h-5 w-5" aria-hidden="true" /></span><span className="text-xs font-bold text-[#7a8ca8]">0{index + 1}</span></div><h3 className="mt-4 font-bold text-[#102343]">{step.title}</h3><p className="mt-2 text-sm leading-6 text-[var(--public-muted)]">{step.description}</p></article>;
          })}
        </div>
      </section>

      <section className="ui-container pb-10 sm:pb-14">
        <div className="text-center"><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2563eb]">Kênh hỗ trợ</p><h2 className="mt-2 text-2xl font-bold tracking-[-0.025em] text-[#102343] sm:text-3xl">Chưa tìm thấy điều bạn cần?</h2><p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-[var(--public-muted)]">Chọn đúng kênh theo nhu cầu. Trợ lý hỗ trợ định hướng, còn hotline kết nối trực tiếp với nhân viên tiếp nhận.</p></div>
        <div className="mt-7 grid gap-4 md:grid-cols-2">
          <SupportCard icon={Phone} title="Gọi hotline" description="Trao đổi trực tiếp theo thời gian làm việc được bệnh viện công bố." action={<a href={`tel:${hotline}`} className="public-button-primary inline-flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-bold">Gọi {hotline}</a>} />
          <SupportCard icon={Bot} title="Trợ lý trực tuyến" description="Tìm chuyên khoa, bác sĩ, gói khám và hướng dẫn sử dụng hệ thống." action={<button type="button" onClick={openPublicChatbot} className="public-button-secondary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold"><MessageCircleQuestion className="h-4 w-4" aria-hidden="true" /> Mở trợ lý</button>} />
        </div>
      </section>
    </main>
  );
}

function CategoryButton({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 text-left text-sm font-semibold transition ${active ? "bg-[#2563eb] text-white" : "text-[var(--public-text-soft)] hover:bg-[#eef4ff]"}`}><span>{label}</span><span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-white/20" : "bg-[#eef4ff] text-[#1749bd]"}`}>{count}</span></button>;
}

function FAQItem({ item, index, expanded, onToggle }: { item: PublicFAQ; index: number; expanded: boolean; onToggle: () => void }) {
  return <article id={`faq-${item.id}`} className={`scroll-mt-36 rounded-2xl border bg-white shadow-sm ${expanded ? "border-[#8bb1ff]" : "border-[var(--public-border)]"}`}><button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={`faq-answer-${item.id}`} className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-bold text-[#102343] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#2563eb] sm:px-5 sm:text-base"><span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#eef4ff] text-xs font-bold text-[#2563eb]">{String(index + 1).padStart(2, "0")}</span><span className="min-w-0 flex-1 leading-6">{item.question}</span><ChevronRight className={`h-4 w-4 shrink-0 text-[#52709f] transition-transform ${expanded ? "rotate-90" : ""}`} aria-hidden="true" /></button>{expanded ? <div id={`faq-answer-${item.id}`} className="border-t border-[var(--public-divider)] px-4 py-4 pl-14 text-sm leading-7 text-[var(--public-text-soft)] sm:px-5 sm:pl-16">{item.answer}</div> : null}</article>;
}

function SupportCard({ icon: Icon, title, description, action }: { icon: typeof Phone; title: string; description: string; action: ReactNode }) {
  return <article className="flex flex-col rounded-2xl border border-[var(--public-border)] bg-white p-5 shadow-sm"><Icon className="h-6 w-6 text-[#2563eb]" aria-hidden="true" /><h3 className="mt-4 font-bold text-[#102343]">{title}</h3><p className="mt-2 flex-1 text-sm leading-6 text-[var(--public-muted)]">{description}</p><div className="mt-5 grid">{action}</div></article>;
}
