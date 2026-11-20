/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Check, ChevronRight, Clock, MapPin, PackageCheck, Phone, Star, Stethoscope } from "lucide-react";
import type { PublicHomeData } from "@/components/public/public-home-types";
import { safeHref } from "@/lib/safe-href";
import { AskKunBanner } from "@/components/public/ask-kun-banner";
import { doctorDisplayName, doctorInitial } from "@/lib/doctor";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { getPublicDoctorPath } from "@/lib/public-routes";
import type { Banner, DoctorProfile, HomePageConfigValue, HomePageSectionConfig, MedicalPackage, PublicFAQ, SiteSettingsValue } from "@/lib/types";

const formatTime = (value: string) => value.slice(0, 5);

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
  const toneClass = tone === "tint" ? "bg-[var(--public-canvas)]" : tone === "blue" ? "bg-[var(--public-primary)] text-white" : "bg-[var(--public-surface)]";
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

function DoctorCard({ doctor }: { doctor: DoctorProfile }) {
  const slots = (doctor.todayAvailableSlots || []).slice(0, 3);
  const total = doctor.todayAvailableSlots?.length || 0;
  const next = doctor.nextAvailableSlot;
  const bookingBase = `/dat-lich?departmentId=${doctor.department.id}&doctorId=${doctor.id}`;
  const reviews = doctor.reviewSummary;
  return (
    <li className="flex flex-col rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-4">
      <div className="flex items-center gap-3">
        {doctor.user.avatar ? (
          <img src={doctor.user.avatar} alt="" width={56} height={56} loading="lazy" decoding="async" className="h-14 w-14 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--public-primary-soft)] text-xl font-semibold text-[var(--public-primary-dark)]" aria-hidden="true">{doctorInitial(doctor.user.fullName)}</span>
        )}
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-[var(--public-ink)]"><Link href={getPublicDoctorPath(doctor)} className="hover:text-[var(--public-primary)]">{doctorDisplayName(doctor)}</Link></h3>
          <p className="truncate text-sm text-[var(--public-muted)]">{[doctor.department.name, doctor.experience ? `${doctor.experience} năm kinh nghiệm` : ""].filter(Boolean).join(" · ")}</p>
        </div>
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-3 text-sm">
        <span className="font-semibold tabular-nums text-[var(--public-primary-dark)]">{formatCurrency(doctor.consultationFee)}</span>
        {reviews?.count ? (
          <span className="inline-flex items-center gap-1 text-[var(--public-muted)]">
            <Star className="h-3.5 w-3.5 fill-[var(--public-warning)] text-[var(--public-warning)]" aria-hidden="true" />
            {reviews.averageRating.toFixed(1)} ({reviews.count})
          </span>
        ) : null}
      </p>
      <div className="mt-3 flex flex-1 flex-wrap items-center gap-2">
        {slots.length ? (
          <>
            <span className="rounded-full bg-[var(--public-success-soft)] px-2.5 py-0.5 text-sm font-semibold text-[var(--public-success)]">Còn {total} giờ hôm nay</span>
            {slots.map((slot) => (
              <Link key={slot.id} href={`${bookingBase}&timeSlotId=${slot.id}`} className="inline-flex min-h-10 items-center rounded-lg border border-[var(--public-border)] px-3 text-sm font-semibold tabular-nums hover:border-[var(--public-primary)]">
                {formatTime(slot.startTime)}
              </Link>
            ))}
          </>
        ) : next ? (
          <Link href={`${bookingBase}&date=${next.date.slice(0, 10)}&timeSlotId=${next.id}`} className="inline-flex min-h-10 items-center rounded-lg border border-[var(--public-border)] px-3 text-sm hover:border-[var(--public-primary)]">
            Gần nhất <strong className="ml-1 font-semibold tabular-nums">{formatTime(next.startTime)}, {formatShortDate(next.date)}</strong>
          </Link>
        ) : (
          <Link href={bookingBase} className="public-button-secondary inline-flex min-h-10 items-center rounded-lg px-4 text-sm font-semibold">Đặt lịch</Link>
        )}
      </div>
    </li>
  );
}

export function DoctorsSection({ doctors, config, loading }: { doctors: DoctorProfile[]; config?: HomePageSectionConfig; loading: boolean }) {
  if (!loading && !doctors.length) return null;
  return (
    <Band id="doctors" tone="tint" labelledBy="doctors-title">
      <SectionTitle id="doctors-title" title={config?.title || "Bác sĩ đang nhận lịch"} description={config?.description || "Chọn giờ còn trống để đặt lịch ngay."} href="/bac-si" linkLabel="Xem tất cả bác sĩ" />
      <div className="mt-6">
        {loading ? <Skeleton /> : <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{doctors.map((doctor) => <DoctorCard key={doctor.id} doctor={doctor} />)}</ul>}
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
                      <h3 className="text-base font-semibold text-[var(--public-ink)] group-hover:text-[var(--public-primary)]">{item.name}</h3>
                      {keywords.length ? (
                        <div className="mt-2">
                          <p className="text-xs text-[var(--public-muted)]">Dấu hiệu thường gặp</p>
                          <ul className="mt-1.5 flex flex-wrap gap-1.5">
                            {keywords.map((keyword) => (
                              <li key={keyword} className="rounded-full bg-[var(--public-primary-soft)] px-2.5 py-0.5 text-xs text-[var(--public-primary-dark)]">{keyword}</li>
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

const PACKAGE_ITEMS_FEATURED = 4;
const PACKAGE_ITEMS_STANDARD = 3;

function PackageCard({ item, featured }: { item: MedicalPackage; featured?: boolean }) {
  const included = (item.items || []).filter((entry) => entry.included);
  const shown = included.slice(0, featured ? PACKAGE_ITEMS_FEATURED : PACKAGE_ITEMS_STANDARD);
  const more = included.length - shown.length;
  const detailHref = `/goi-kham/${item.slug || item.id}`;
  const body = (
    <>
      <div className={`relative overflow-hidden bg-[var(--public-primary-soft)] ${featured ? "aspect-[16/9] md:aspect-auto md:min-h-[18rem]" : "aspect-[16/9]"}`}>
        {item.image ? (
          <img src={item.image} alt="" width={800} height={450} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,var(--public-primary-soft),#9ccaff)] text-[var(--public-primary-dark)]" aria-hidden="true">
            <PackageCheck className={featured ? "h-16 w-16" : "h-12 w-12"} />
          </div>
        )}
        {item.isPopular || item.isBHYTSupport ? (
          <p className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {item.isPopular ? <span className="rounded-full bg-[var(--public-primary)] px-3 py-1 text-xs font-medium text-white shadow">Được chọn nhiều</span> : null}
            {item.isBHYTSupport ? <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-[#1e7b34] shadow">Hỗ trợ BHYT</span> : null}
          </p>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {item.department?.name ? <p className="text-sm text-[var(--public-muted)]">{item.department.name}</p> : null}
        <h3 className={`mt-1 font-semibold text-[var(--public-ink)] ${featured ? "text-xl sm:text-2xl" : "text-lg"}`}>
          <Link href={detailHref} className="hover:text-[var(--public-primary)]">{item.name}</Link>
        </h3>
        {shown.length ? (
          <ul className={`mt-3 gap-x-4 gap-y-1.5 text-[0.95rem] text-[var(--public-text-soft)] ${featured ? "grid sm:grid-cols-2" : "space-y-1.5"}`}>
            {shown.map((entry) => (
              <li key={entry.id} className="flex items-start gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-[var(--public-success)]" aria-hidden="true" />{entry.name}</li>
            ))}
          </ul>
        ) : item.summary ? (
          <p className="mt-3 line-clamp-3 text-[0.95rem] text-[var(--public-text-soft)]">{item.summary}</p>
        ) : null}
        {more > 0 ? <Link href={detailHref} className="mt-2 text-sm font-medium text-[var(--public-primary)] underline-offset-4 hover:underline">+ {more} hạng mục khác</Link> : null}
        {item.resultTime ? (
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-[var(--public-muted)]"><Clock className="h-4 w-4" aria-hidden="true" />Có kết quả: {item.resultTime}</p>
        ) : null}
        <div className="mt-auto pt-4">
          <p className="text-xs text-[var(--public-muted)]">Chi phí dự kiến</p>
          <p className={`font-semibold tabular-nums text-[var(--public-primary-dark)] ${featured ? "text-3xl" : "text-2xl"}`}>{formatCurrency(item.finalPrice)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href={detailHref} className="public-button-secondary inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold">Xem chi tiết</Link>
            <Link href={`/dat-lich?packageId=${item.id}`} className="public-button-primary inline-flex min-h-11 items-center rounded-lg px-5 text-sm font-semibold">Chọn gói</Link>
          </div>
        </div>
      </div>
    </>
  );
  if (featured) {
    return (
      <div className="rounded-3xl bg-[linear-gradient(135deg,var(--dk-blue),var(--dk-teal))] p-[2px] shadow-xl">
        <div className="grid overflow-hidden rounded-[calc(1.5rem-2px)] bg-[var(--public-surface)] md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">{body}</div>
      </div>
    );
  }
  return <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface)] shadow-sm">{body}</div>;
}

// Gói khám: nền gradient nhạt kèm hai vòng tròn mờ trang trí; gói được đánh dấu "được chọn nhiều" (hoặc gói đầu tiên) là thẻ nổi bật rộng suốt hàng,
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
export function SupportSection({ faqs, settings }: { faqs: PublicFAQ[]; settings: SiteSettingsValue | null }) {
  const items = faqs.slice(0, 5);
  const hotline = settings?.hotline?.trim();
  return (
    <Band id="hoi-dap" labelledBy="faq-title">
      <div className={`grid grid-cols-[minmax(0,1fr)] gap-8 ${items.length ? "lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]" : ""}`}>
        {items.length ? (
          <div>
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
          </div>
        ) : null}

        <aside aria-labelledby="support-title" className="self-start rounded-2xl bg-[var(--public-primary-soft)] p-5 sm:p-6">
          <h2 id={items.length ? "support-title" : "faq-title"} className="text-xl font-bold text-[var(--public-primary-dark)]">Quý khách cần hỗ trợ?</h2>
          <dl className="mt-3 space-y-3 text-base text-[var(--public-ink)]">
            {hotline ? (
              <div className="flex items-start gap-3"><Phone className="mt-1 h-4 w-4 shrink-0 text-[var(--public-primary-dark)]" aria-hidden="true" /><div><dt className="sr-only">Đường dây nóng</dt><dd><a href={`tel:${hotline}`} className="font-semibold tabular-nums">{hotline}</a></dd></div></div>
            ) : null}
            {settings?.workingHours ? (
              <div className="flex items-start gap-3"><Clock className="mt-1 h-4 w-4 shrink-0 text-[var(--public-primary-dark)]" aria-hidden="true" /><div><dt className="sr-only">Giờ làm việc</dt><dd>{settings.workingHours}</dd></div></div>
            ) : null}
            {settings?.address ? (
              <div className="flex items-start gap-3"><MapPin className="mt-1 h-4 w-4 shrink-0 text-[var(--public-primary-dark)]" aria-hidden="true" /><div><dt className="sr-only">Địa chỉ</dt><dd>{settings.address}</dd></div></div>
            ) : null}
          </dl>
          {!hotline && !settings?.workingHours && !settings?.address ? <p className="mt-2 text-base text-[var(--public-text-soft)]">Đặt lịch trực tuyến hoặc hỏi trợ lý để được hướng dẫn.</p> : null}
          <Link href="/dat-lich" className="public-button-primary mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full px-6 text-base font-semibold">Đặt lịch khám</Link>
        </aside>
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
