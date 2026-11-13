/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, CalendarCheck, Check, ChevronRight, Clock, MapPin, Phone, ReceiptText, ShieldCheck, Star, UserRoundCheck } from "lucide-react";
import type { PublicHomeData } from "@/components/public/public-home-types";
import { doctorDisplayName, doctorInitial } from "@/lib/doctor";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { getPublicDoctorPath } from "@/lib/public-routes";
import type { Banner, DoctorProfile, HomePageConfigValue, HomePageSectionConfig, MedicalPackage, PublicFAQ, SiteSettingsValue } from "@/lib/types";

const formatTime = (value: string) => value.slice(0, 5);

// Chỉ cho liên kết trong site hoặc https; còn lại dùng giá trị dự phòng.
export const safeHref = (value: string | null | undefined, fallback = "/") => {
  const href = value?.trim();
  if (!href) return fallback;
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  try {
    return new URL(href).protocol === "https:" ? href : fallback;
  } catch {
    return fallback;
  }
};

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
    <div className="border-b border-[var(--public-border)] bg-[var(--public-surface-muted)]">
      <p className="ui-container flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm text-[var(--public-ink)]">
        {announcement.label ? <strong className="font-semibold">{announcement.label}</strong> : null}
        <span>{announcement.message}</span>
        {announcement.ctaLabel ? (
          <Link href={safeHref(announcement.ctaHref)} className="font-semibold text-[var(--public-primary)] underline underline-offset-4">{announcement.ctaLabel}</Link>
        ) : null}
      </p>
    </div>
  );
}

const FIELD = "ui-field mt-1 min-h-12 w-full px-3 text-base";

// Đầu trang: lời chào ngắn, ô chọn chuyên khoa dẫn thẳng vào đặt lịch, thông tin liên hệ.
export function Hero({ settings, banner, departments }: { settings: SiteSettingsValue | null; banner?: Banner; departments: PublicHomeData["departments"] }) {
  const hotline = settings?.hotline?.trim();
  return (
    <section className="border-b border-[var(--public-divider)] bg-[var(--public-surface)]">
      <div className="ui-container grid grid-cols-[minmax(0,1fr)] gap-8 py-8 sm:py-12 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-12 lg:py-14">
        <div>
          <h1 className="text-[1.75rem] font-bold leading-tight text-[var(--public-ink)] sm:text-4xl">
            Đặt lịch khám trực tuyến, biết giờ trống và chi phí trước khi đến
          </h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-[var(--public-text-soft)]">
            Chọn bác sĩ và giờ khám còn trống, xác nhận bằng mã OTP. Quý khách không cần tạo tài khoản.
          </p>

          <form action="/dat-lich" method="get" className="mt-6 max-w-xl rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-4">
            <label htmlFor="home-department" className="block text-sm font-semibold text-[var(--public-ink)]">Chuyên khoa</label>
            <select id="home-department" name="departmentId" defaultValue="" className={FIELD}>
              <option value="">Tất cả chuyên khoa</option>
              {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <button type="submit" className="public-button-primary mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-6 text-base font-semibold">
              <CalendarCheck className="h-5 w-5" aria-hidden="true" />
              Tìm giờ trống
            </button>
          </form>
          <p className="mt-3 text-sm text-[var(--public-muted)]">
            Đã có lịch hẹn? <Link href="/tai-khoan/lich-hen" className="font-semibold text-[var(--public-primary)] underline underline-offset-4">Xem lịch của tôi</Link>
          </p>
        </div>

        <div className="space-y-4 self-start">
          {banner ? (
            <Link href={safeHref(banner.linkUrl)} className="block overflow-hidden rounded-xl border border-[var(--public-border)]">
              <picture>
                {banner.mobileImage ? <source media="(max-width: 639px)" srcSet={banner.mobileImage} /> : null}
                <img src={banner.image} alt={banner.title} className="aspect-[4/3] w-full object-cover" loading="eager" fetchPriority="high" />
              </picture>
            </Link>
          ) : null}
          <dl className="space-y-3 rounded-xl border border-[var(--public-border)] p-4 text-sm">
            {hotline ? (
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[var(--public-primary)]" aria-hidden="true" />
                <div>
                  <dt className="text-[var(--public-muted)]">Đường dây nóng</dt>
                  <dd><a href={`tel:${hotline}`} className="text-lg font-semibold tabular-nums text-[var(--public-ink)]">{hotline}</a></dd>
                </div>
              </div>
            ) : null}
            {settings?.workingHours ? (
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--public-primary)]" aria-hidden="true" />
                <div>
                  <dt className="text-[var(--public-muted)]">Giờ làm việc</dt>
                  <dd className="font-medium">{settings.workingHours}</dd>
                </div>
              </div>
            ) : null}
            {settings?.address ? (
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--public-primary)]" aria-hidden="true" />
                <div>
                  <dt className="text-[var(--public-muted)]">Địa chỉ</dt>
                  <dd className="font-medium">{settings.address}</dd>
                </div>
              </div>
            ) : null}
          </dl>
        </div>
      </div>
    </section>
  );
}

const BENEFITS = [
  { icon: UserRoundCheck, title: "Không cần tài khoản", text: "Xác nhận lịch bằng mã OTP." },
  { icon: Clock, title: "Giờ trống cập nhật", text: "Chọn đúng giờ còn tiếp nhận." },
  { icon: ReceiptText, title: "Biết chi phí trước", text: "Chi phí dự kiến hiển thị rõ." },
  { icon: ShieldCheck, title: "Hỗ trợ BHYT", text: "Theo từng gói khám." },
];

export function Benefits() {
  return (
    <section aria-label="Lợi ích khi đặt lịch" className="border-b border-[var(--public-divider)] bg-[var(--public-surface)]">
      <ul className="ui-container grid grid-cols-2 gap-x-4 gap-y-5 py-6 lg:grid-cols-4">
        {BENEFITS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex items-start gap-3">
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--public-primary)]" aria-hidden="true" />
            <div>
              <p className="font-semibold text-[var(--public-ink)]">{title}</p>
              <p className="text-sm text-[var(--public-muted)]">{text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionShell({ id, title, description, href, linkLabel, children }: { id: string; title: string; description?: string; href?: string; linkLabel?: string; children: ReactNode }) {
  return (
    <section id={id} className="ui-container scroll-mt-24 py-8 sm:py-10">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-[var(--public-ink)] sm:text-2xl">{title}</h2>
          {description ? <p className="mt-1 text-base text-[var(--public-muted)]">{description}</p> : null}
        </div>
        {href && linkLabel ? <Link href={href} className="shrink-0 py-2 text-sm font-semibold text-[var(--public-primary)] underline underline-offset-4">{linkLabel}</Link> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function RowSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="divide-y divide-[var(--public-divider)] overflow-hidden rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)]" aria-busy="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 p-4">
          <span className="skeleton-shimmer h-11 w-11 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <span className="skeleton-shimmer block h-4 w-1/2 rounded" />
            <span className="skeleton-shimmer block h-3 w-1/3 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DoctorRow({ doctor }: { doctor: DoctorProfile }) {
  const slots = (doctor.todayAvailableSlots || []).slice(0, 3);
  const next = doctor.nextAvailableSlot;
  const bookingBase = `/dat-lich?departmentId=${doctor.department.id}&doctorId=${doctor.id}`;
  const reviews = doctor.reviewSummary;
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {doctor.user.avatar ? (
          <img src={doctor.user.avatar} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--public-primary-soft)] text-xl font-semibold text-[var(--public-primary-dark)]" aria-hidden="true">{doctorInitial(doctor.user.fullName)}</span>
        )}
        <div className="min-w-0">
          <Link href={getPublicDoctorPath(doctor)} className="block truncate font-semibold text-[var(--public-ink)] hover:text-[var(--public-primary)]">{doctorDisplayName(doctor)}</Link>
          <p className="truncate text-sm text-[var(--public-muted)]">{[doctor.department.name, doctor.experience ? `${doctor.experience} năm kinh nghiệm` : ""].filter(Boolean).join(" · ")}</p>
          <p className="flex flex-wrap items-center gap-x-3 text-sm">
            <span className="font-semibold tabular-nums text-[var(--public-primary-dark)]">{formatCurrency(doctor.consultationFee)}</span>
            {reviews?.count ? (
              <span className="inline-flex items-center gap-1 text-[var(--public-muted)]">
                <Star className="h-3.5 w-3.5 fill-[var(--public-warning)] text-[var(--public-warning)]" aria-hidden="true" />
                {reviews.averageRating.toFixed(1)} ({reviews.count})
              </span>
            ) : null}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {slots.length ? (
          <>
            <span className="text-sm text-[var(--public-muted)]">Hôm nay</span>
            {slots.map((slot) => (
              <Link key={slot.id} href={`${bookingBase}&timeSlotId=${slot.id}`} className="inline-flex min-h-10 items-center rounded-lg border border-[var(--public-border)] px-3 text-sm font-semibold tabular-nums text-[var(--public-ink)] hover:border-[var(--public-primary)]">
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
    <SectionShell id="doctors" title={config?.title || "Bác sĩ đang nhận lịch"} description={config?.description || "Chọn giờ còn trống để đặt lịch ngay."} href="/bac-si" linkLabel="Xem tất cả bác sĩ">
      {loading ? (
        <RowSkeleton />
      ) : (
        <ul className="divide-y divide-[var(--public-divider)] overflow-hidden rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)]">
          {doctors.map((doctor) => <DoctorRow key={doctor.id} doctor={doctor} />)}
        </ul>
      )}
    </SectionShell>
  );
}

// Chuyên khoa kèm vài triệu chứng thường gặp để người khám tự chọn đúng khoa.
export function DepartmentsSection({ departments, config, loading }: { departments: PublicHomeData["departments"]; config?: HomePageSectionConfig; loading: boolean }) {
  if (!loading && !departments.length) return null;
  return (
    <SectionShell id="departments" title={config?.title || "Chuyên khoa"} description={config?.description || "Chọn chuyên khoa theo nhu cầu khám của bạn."} href="/chuyen-khoa" linkLabel="Tất cả chuyên khoa">
      {loading ? (
        <RowSkeleton rows={4} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((item) => {
            const keywords = (item.symptomKeywords || []).slice(0, 3);
            return (
              <li key={item.id}>
                <Link href={item.slug ? `/chuyen-khoa/${item.slug}` : "/chuyen-khoa"} className="group flex h-full flex-col rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-4 hover:border-[var(--public-primary)]">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[var(--public-ink)]">{item.name}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[var(--public-muted)] group-hover:text-[var(--public-primary)]" aria-hidden="true" />
                  </span>
                  {keywords.length ? (
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {keywords.map((keyword) => <span key={keyword} className="rounded-md bg-[var(--public-primary-soft)] px-2 py-0.5 text-sm text-[var(--public-primary-dark)]">{keyword}</span>)}
                    </span>
                  ) : item.description ? (
                    <span className="mt-1 line-clamp-2 text-sm text-[var(--public-muted)]">{item.description}</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SectionShell>
  );
}

export function PackagesSection({ packages, config, loading }: { packages: MedicalPackage[]; config?: HomePageSectionConfig; loading: boolean }) {
  if (!loading && !packages.length) return null;
  return (
    <SectionShell id="packages" title={config?.title || "Gói khám"} description={config?.description || "Chi phí dự kiến được hiển thị trước khi đặt lịch."} href="/goi-kham" linkLabel="Tất cả gói khám">
      {loading ? (
        <RowSkeleton />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((item) => {
            const included = (item.items || []).filter((entry) => entry.included).slice(0, 3);
            return (
              <li key={item.id}>
                <div className="flex h-full flex-col rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-4">
                  <p className="text-sm text-[var(--public-muted)]">
                    {[item.department?.name, item.isPopular ? "Được chọn nhiều" : "", item.isBHYTSupport ? "Hỗ trợ BHYT" : ""].filter(Boolean).join(" · ") || "Gói khám"}
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-[var(--public-ink)]"><Link href={`/goi-kham/${item.slug || item.id}`} className="hover:text-[var(--public-primary)]">{item.name}</Link></h3>
                  {included.length ? (
                    <ul className="mt-2 space-y-1 text-sm text-[var(--public-text-soft)]">
                      {included.map((entry) => (
                        <li key={entry.id} className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--public-success)]" aria-hidden="true" />{entry.name}</li>
                      ))}
                    </ul>
                  ) : item.summary ? (
                    <p className="mt-2 line-clamp-3 text-sm text-[var(--public-text-soft)]">{item.summary}</p>
                  ) : null}
                  <div className="mt-auto flex items-center justify-between gap-3 pt-4">
                    <p className="text-xl font-bold tabular-nums text-[var(--public-primary-dark)]">{formatCurrency(item.finalPrice)}</p>
                    <Link href={`/dat-lich?packageId=${item.id}`} className="public-button-primary inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-semibold">Chọn gói</Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionShell>
  );
}

const STEPS = [
  { title: "Chọn dịch vụ", text: "Chuyên khoa, bác sĩ hoặc gói khám." },
  { title: "Chọn giờ khám", text: "Xem ngày và giờ còn trống." },
  { title: "Điền thông tin", text: "Họ tên và số điện thoại." },
  { title: "Xác nhận OTP", text: "Nhập mã để nhận mã lịch hẹn." },
];

export function Steps() {
  return (
    <SectionShell id="quy-trinh" title="Đặt lịch trong 4 bước" href="/huong-dan/dat-lich" linkLabel="Xem hướng dẫn">
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, index) => (
          <li key={step.title} className="rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--public-primary-soft)] text-sm font-bold text-[var(--public-primary-dark)]" aria-hidden="true">{index + 1}</span>
            <p className="mt-2 font-semibold text-[var(--public-ink)]">{step.title}</p>
            <p className="text-sm text-[var(--public-muted)]">{step.text}</p>
          </li>
        ))}
      </ol>
    </SectionShell>
  );
}

// Hỏi đáp rút gọn dùng thẻ details nên không cần JavaScript; cùng dữ liệu với trang Hỏi đáp.
export function FaqSection({ faqs }: { faqs: PublicFAQ[] }) {
  const items = faqs.slice(0, 5);
  if (!items.length) return null;
  return (
    <SectionShell id="hoi-dap" title="Câu hỏi thường gặp" href="/hoi-dap" linkLabel="Xem tất cả">
      <div className="divide-y divide-[var(--public-divider)] overflow-hidden rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)]">
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
    </SectionShell>
  );
}

export function ClosingCta({ settings }: { settings: SiteSettingsValue | null }) {
  const hotline = settings?.hotline?.trim();
  return (
    <section aria-labelledby="closing-title" className="ui-container py-8 sm:py-10">
      <div className="flex flex-col gap-4 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 id="closing-title" className="text-xl font-bold text-[var(--public-ink)]">Quý khách cần hỗ trợ đặt lịch?</h2>
          <p className="mt-1 text-base text-[var(--public-muted)]">
            {hotline ? <>Vui lòng gọi <a href={`tel:${hotline}`} className="font-semibold tabular-nums text-[var(--public-ink)]">{hotline}</a> hoặc đặt lịch trực tuyến.</> : "Đặt lịch trực tuyến hoặc hỏi trợ lý để được hướng dẫn."}
          </p>
        </div>
        <Link href="/dat-lich" className="public-button-primary inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-lg px-6 text-base font-semibold">
          Đặt lịch khám
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

export function Partners({ banners, config }: { banners: Banner[]; config?: HomePageSectionConfig }) {
  if (!banners.length) return null;
  return (
    <section aria-label={config?.title || "Đối tác"} className="ui-container py-6 sm:py-8">
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
    </section>
  );
}
