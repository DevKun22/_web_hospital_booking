/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, ChevronRight, Stethoscope } from "lucide-react";
import type { PublicHomeData } from "@/components/public/public-home-types";
import { safeHref } from "@/lib/safe-href";
import { AskKunBanner } from "@/components/public/ask-kun-banner";
import { PackageCard } from "@/features/packages/components/package-card";
import { DoctorCard } from "@/features/doctors/components/doctor-card";
import type { Banner, DoctorProfile, HomePageConfigValue, HomePageSectionConfig, MedicalPackage, PublicFAQ } from "@/lib/types";

// Thông báo chỉ hiện khi đang bật, có nội dung và đang trong khoảng ngày cấu hình (nếu có).
export function isAnnouncementActive(announcement: HomePageConfigValue["announcement"] | undefined, now = Date.now()) {
  if (!announcement?.enabled || !announcement.message.trim()) return false;
  const started = !announcement.startAt || Date.parse(announcement.startAt) <= now;
  const notEnded = !announcement.endAt || Date.parse(announcement.endAt) >= now;
  return started && notEnded;
}

export function Notice({ announcement }: { announcement?: HomePageConfigValue["announcement"] }) {
  if (!announcement || !isAnnouncementActive(announcement)) return null;
  return (
    <div className="border-b border-[var(--public-border)] bg-[var(--public-primary-soft)]">
      <p className="ui-container flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm text-[var(--public-primary-dark)]">
        {announcement.label ? <strong className="font-semibold">{announcement.label}</strong> : null}
        <span>{announcement.message}</span>
        {announcement.ctaLabel ? (
          <Link href={safeHref(announcement.ctaHref)} className="font-semibold underline underline-offset-4">{announcement.ctaLabel}</Link>
        ) : null}
      </p>
    </div>
  );
}

function Band({ id, tone = "plain", labelledBy, children }: { id?: string; tone?: "plain" | "tint" | "blue"; labelledBy?: string; children: ReactNode }) {
  const toneClass = tone === "tint" ? "bg-[var(--public-canvas)]" : tone === "blue" ? "bg-[var(--public-solid)] text-white" : "bg-[var(--public-surface)]";
  return (
    <section id={id} aria-labelledby={labelledBy} className={`scroll-mt-24 ${toneClass}`}>
      <div className="ui-container py-9 sm:py-12">{children}</div>
    </section>
  );
}

// Tiêu đề mục có gạch chân ngắn màu nhấn.
function SectionTitle({ id, title, description, href, linkLabel, onBlue = false }: { id: string; title: string; description?: string; href?: string; linkLabel?: string; onBlue?: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div className="min-w-0 flex-1 basis-60">
        <h2 id={id} className="text-xl font-bold sm:text-2xl">{title}</h2>
        <span aria-hidden="true" className={`mt-2 block h-[3px] w-10 rounded ${onBlue ? "bg-white/80" : "bg-[var(--public-care-mint)]"}`} />
        {description ? <p className={`mt-2 text-base ${onBlue ? "text-white/90" : "text-[var(--public-muted)]"}`}>{description}</p> : null}
      </div>
      {href && linkLabel ? <Link href={href} className={`shrink-0 py-2 text-sm font-semibold underline underline-offset-4 ${onBlue ? "text-white" : "text-[var(--public-primary)]"}`}>{linkLabel}</Link> : null}
    </div>
  );
}

function Skeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
      {Array.from({ length: count }).map((_, index) => <span key={index} className="skeleton-shimmer block h-40 rounded-xl" />)}
    </div>
  );
}

export function DoctorsSection({ doctors, config, loading }: { doctors: DoctorProfile[]; config?: HomePageSectionConfig; loading: boolean }) {
  if (!loading && !doctors.length) return null;
  return (
    <Band id="doctors" tone="tint" labelledBy="doctors-title">
      <SectionTitle id="doctors-title" title={config?.title || "Bác sĩ đang nhận lịch"} description={config?.description || "Chọn giờ còn trống để đặt lịch ngay."} href="/bac-si" linkLabel="Xem tất cả bác sĩ" />
      <div className="mt-6">
        {loading ? <Skeleton /> : <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{doctors.map((doctor) => <DoctorCard key={doctor.id} doctor={doctor} />)}</ul>}
      </div>
    </Band>
  );
}

export function DepartmentsSection({ departments, config, loading }: { departments: PublicHomeData["departments"]; config?: HomePageSectionConfig; loading: boolean }) {
  if (!loading && !departments.length) return null;
  return (
    <Band id="departments" labelledBy="departments-title">
      <SectionTitle id="departments-title" title={config?.title || "Chuyên khoa"} description={config?.description || "Chọn chuyên khoa theo nhu cầu khám của bạn."} href="/chuyen-khoa" linkLabel="Tất cả chuyên khoa" />
      <div className="mt-6">
        {loading ? (
          <Skeleton count={4} />
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {departments.map((item) => {
              const keywords = (item.symptomKeywords || []).filter(Boolean).slice(0, 3);
              return (
                <li key={item.id}>
                  <Link
                    href={item.slug ? `/chuyen-khoa/${item.slug}` : "/chuyen-khoa"}
                    className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface)] transition hover:-translate-y-0.5 hover:border-[var(--public-primary)] hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                  >
                    <div className="aspect-[4/3] overflow-hidden bg-[var(--public-primary-soft)]">
                      {item.image ? (
                        <img src={item.image} alt="" width={640} height={480} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-[var(--public-primary-dark)]" aria-hidden="true">
                          <Stethoscope className="h-10 w-10" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-3.5 sm:p-4">
                      <h3 className="text-lg font-semibold leading-snug text-[var(--public-ink)] group-hover:text-[var(--public-primary)]">{item.name}</h3>
                      {keywords.length ? (
                        <div className="mt-2">
                          <p className="text-sm text-[var(--public-muted)]">Dấu hiệu thường gặp</p>
                          <ul className="mt-1.5 flex flex-wrap gap-1.5">
                            {keywords.map((keyword) => (
                              <li key={keyword} className="rounded-full bg-[var(--public-primary-soft)] px-2.5 py-0.5 text-sm text-[var(--public-primary-dark)]">{keyword}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      <span className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-medium text-[var(--public-primary)]">
                        Xem chi tiết
                        <span className="sr-only"> chuyên khoa {item.name}</span>
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        {!loading ? <AskKunBanner /> : null}
      </div>
    </Band>
  );
}

// Gói khám: nền gradient nhạt kèm hai vòng tròn mờ trang trí; gói được đánh dấu "nổi bật" (hoặc gói đầu tiên) là thẻ nổi bật rộng suốt hàng,
// các gói còn lại là thẻ đứng. Chỉ hiện nhãn, giá, hạng mục, thời gian trả kết quả khi gói có dữ liệu đó; không có giá gốc nên không hiện giảm giá.
export function PackagesSection({ packages, config, loading }: { packages: MedicalPackage[]; config?: HomePageSectionConfig; loading: boolean }) {
  if (!loading && !packages.length) return null;
  const featured = packages.find((item) => item.isPopular) ?? packages[0];
  const others = packages.filter((item) => item.id !== featured?.id);
  return (
    <section id="packages" aria-labelledby="packages-title" className="relative scroll-mt-24 overflow-hidden bg-[linear-gradient(180deg,var(--public-canvas)_0%,var(--public-primary-soft)_100%)]">
      <span aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[var(--public-primary)] opacity-10 blur-2xl" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-[var(--dk-teal)] opacity-10 blur-2xl" />
      <div className="ui-container relative py-10 sm:py-14">
        <SectionTitle id="packages-title" title={config?.title || "Gói khám"} description={config?.description || "Chi phí dự kiến được hiển thị trước khi đặt lịch."} href="/goi-kham" linkLabel="Tất cả gói khám" />
        <div className="mt-6">
          {loading ? (
            <Skeleton />
          ) : (
            <div className="space-y-4 sm:space-y-5">
              {featured ? <PackageCard item={featured} featured /> : null}
              {others.length ? (
                <ul className={`grid gap-4 sm:gap-5 ${others.length > 2 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"}`}>
                  {others.map((item) => (
                    <li key={item.id}><PackageCard item={item} /></li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// Hỏi đáp rút gọn dùng thẻ details nên không cần JavaScript; cùng dữ liệu với trang Hỏi đáp.
// Thông tin liên hệ và nút đặt lịch đã có ở chân trang nên không lặp lại ở đây; chưa có câu hỏi nào thì ẩn cả mục.
export function SupportSection({ faqs }: { faqs: PublicFAQ[] }) {
  const items = faqs.slice(0, 5);
  if (!items.length) return null;
  return (
    <Band id="hoi-dap" labelledBy="faq-title">
      <SectionTitle id="faq-title" title="Câu hỏi thường gặp" href="/hoi-dap" linkLabel="Xem tất cả" />
      <div className="mt-6 divide-y divide-[var(--public-divider)] overflow-hidden rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)]">
        {items.map((item) => (
          <details key={item.id} className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 font-semibold text-[var(--public-ink)] hover:bg-[var(--public-surface-muted)]">
              <span className="min-w-0 flex-1">{item.question}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--public-muted)] transition-transform group-open:rotate-90" aria-hidden="true" />
            </summary>
            <p className="px-4 pb-4 text-base leading-7 text-[var(--public-text-soft)]">{item.answer}</p>
          </details>
        ))}
      </div>
    </Band>
  );
}

export function Partners({ banners, config }: { banners: Banner[]; config?: HomePageSectionConfig }) {
  if (!banners.length) return null;
  return (
    <section aria-label={config?.title || "Đối tác"} className="bg-[var(--public-canvas)]">
      <div className="ui-container py-8">
        <h2 className="text-sm font-semibold text-[var(--public-muted)]">{config?.title || "Đơn vị phối hợp"}</h2>
        <ul className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-4">
          {banners.map((banner) => (
            <li key={banner.id}>
              {banner.linkUrl ? (
                <a href={safeHref(banner.linkUrl, "#")} target="_blank" rel="noopener noreferrer" aria-label={banner.title}>
                  <img src={banner.image} alt={banner.title} className="h-9 w-auto max-w-32 object-contain opacity-80 grayscale hover:opacity-100 hover:grayscale-0" loading="lazy" />
                </a>
              ) : (
                <img src={banner.image} alt={banner.title} className="h-9 w-auto max-w-32 object-contain opacity-80 grayscale" loading="lazy" />
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
