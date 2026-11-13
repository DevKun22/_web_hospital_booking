/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarPlus, ChevronRight, Clock, MapPin, Phone, Stethoscope } from "lucide-react";
import type { PublicHomeData } from "@/components/public/public-home-types";
import { doctorDisplayName, doctorInitial } from "@/lib/doctor";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { getPublicDoctorPath } from "@/lib/public-routes";
import type { Banner, DoctorProfile, HomePageConfigValue, HomePageSectionConfig, MedicalPackage, SiteSettingsValue } from "@/lib/types";

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

export function Hero({ settings, banner }: { settings: SiteSettingsValue | null; banner?: Banner }) {
  const hotline = settings?.hotline?.trim();
  return (
    <section className="border-b border-[var(--public-border)] bg-[var(--public-surface)]">
      <div className="ui-container grid gap-6 py-7 sm:py-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12 lg:py-12">
        <div>
          <h1 className="text-[1.75rem] font-bold leading-tight text-[var(--public-ink)] sm:text-4xl">Đặt lịch khám trực tuyến</h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-[var(--public-text-soft)]">
            Chọn chuyên khoa, bác sĩ và giờ khám còn trống. Xác nhận bằng mã OTP gửi về điện thoại hoặc email, không cần tạo tài khoản.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link href="/dat-lich" className="public-button-primary inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-6 text-base font-semibold">
              <CalendarPlus className="h-5 w-5" aria-hidden="true" />
              Đặt lịch khám
            </Link>
            <Link href="/bac-si" className="public-button-secondary inline-flex min-h-12 items-center justify-center rounded-lg px-6 text-base font-semibold">
              Tìm bác sĩ
            </Link>
          </div>
        </div>

        <dl className="space-y-3 self-start rounded-lg border border-[var(--public-border)] p-4 text-sm">
          {hotline ? (
            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[var(--public-primary)]" aria-hidden="true" />
              <div>
                <dt className="text-[var(--public-muted)]">Hotline</dt>
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

      {banner ? (
        <div className="ui-container pb-7 lg:pb-10">
          <Link href={safeHref(banner.linkUrl)} className="block overflow-hidden rounded-lg border border-[var(--public-border)]">
            <picture>
              {banner.mobileImage ? <source media="(max-width: 639px)" srcSet={banner.mobileImage} /> : null}
              <img src={banner.image} alt={banner.title} className="aspect-[16/7] w-full object-cover sm:aspect-[21/7]" loading="eager" />
            </picture>
          </Link>
        </div>
      ) : null}
    </section>
  );
}

const SHORTCUTS = [
  { href: "/dat-lich", label: "Đặt lịch khám", hint: "Chọn bác sĩ và giờ trống" },
  { href: "/bac-si", label: "Bác sĩ", hint: "Tìm theo tên, chuyên khoa" },
  { href: "/chuyen-khoa", label: "Chuyên khoa", hint: "Danh sách khoa đang khám" },
  { href: "/goi-kham", label: "Gói khám", hint: "Giá rõ ràng, theo nhu cầu" },
  { href: "/tai-khoan/lich-hen", label: "Lịch của tôi", hint: "Xem, đổi, hủy lịch hẹn" },
  { href: "/hoi-dap", label: "Hỏi đáp", hint: "Giải đáp thắc mắc thường gặp" },
];

export function Shortcuts() {
  return (
    <section aria-label="Lối tắt" className="ui-container py-6 sm:py-8">
      <ul className="grid overflow-hidden rounded-lg border border-[var(--public-border)] bg-[var(--public-surface)] sm:grid-cols-2 lg:grid-cols-3">
        {SHORTCUTS.map((item) => (
          <li key={item.href} className="border-b border-[var(--public-divider)] last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0 lg:[&:nth-last-child(3)]:border-b-0">
            <Link href={item.href} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-[var(--public-surface-muted)]">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-[var(--public-ink)]">{item.label}</span>
                <span className="block truncate text-sm text-[var(--public-muted)]">{item.hint}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[var(--public-muted)]" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionShell({ id, title, description, href, linkLabel, children }: { id: string; title: string; description?: string; href: string; linkLabel: string; children: ReactNode }) {
  return (
    <section id={id} className="ui-container scroll-mt-24 py-6 sm:py-8">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-[var(--public-ink)] sm:text-2xl">{title}</h2>
          {description ? <p className="mt-1 text-sm text-[var(--public-muted)]">{description}</p> : null}
        </div>
        <Link href={href} className="shrink-0 py-2 text-sm font-semibold text-[var(--public-primary)] underline underline-offset-4">{linkLabel}</Link>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function RowSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="divide-y divide-[var(--public-divider)] overflow-hidden rounded-lg border border-[var(--public-border)] bg-[var(--public-surface)]" aria-busy="true">
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
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {doctor.user.avatar ? (
          <img src={doctor.user.avatar} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--public-surface-muted)] text-lg font-semibold text-[var(--public-primary-dark)]" aria-hidden="true">{doctorInitial(doctor.user.fullName)}</span>
        )}
        <div className="min-w-0">
          <Link href={getPublicDoctorPath(doctor)} className="block truncate font-semibold text-[var(--public-ink)] hover:text-[var(--public-primary)]">{doctorDisplayName(doctor)}</Link>
          <p className="truncate text-sm text-[var(--public-muted)]">{[doctor.department.name, doctor.experience ? `${doctor.experience} năm kinh nghiệm` : ""].filter(Boolean).join(" · ")}</p>
          <p className="text-sm font-semibold tabular-nums text-[var(--public-primary-dark)]">{formatCurrency(doctor.consultationFee)}</p>
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
    <SectionShell id="doctors" title={config?.title || "Bác sĩ đang nhận lịch"} description={config?.description} href="/bac-si" linkLabel="Xem tất cả bác sĩ">
      {loading ? (
        <RowSkeleton />
      ) : (
        <ul className="divide-y divide-[var(--public-divider)] overflow-hidden rounded-lg border border-[var(--public-border)] bg-[var(--public-surface)]">
          {doctors.map((doctor) => <DoctorRow key={doctor.id} doctor={doctor} />)}
        </ul>
      )}
    </SectionShell>
  );
}

export function DepartmentsSection({ departments, config, loading }: { departments: PublicHomeData["departments"]; config?: HomePageSectionConfig; loading: boolean }) {
  if (!loading && !departments.length) return null;
  return (
    <SectionShell id="departments" title={config?.title || "Chuyên khoa"} description={config?.description} href="/chuyen-khoa" linkLabel="Tất cả chuyên khoa">
      {loading ? (
        <RowSkeleton rows={4} />
      ) : (
        <ul className="grid overflow-hidden rounded-lg border border-[var(--public-border)] bg-[var(--public-surface)] sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((item) => (
            <li key={item.id} className="border-b border-[var(--public-divider)] sm:border-r">
              <Link href={item.slug ? `/chuyen-khoa/${item.slug}` : "/chuyen-khoa"} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-[var(--public-surface-muted)]">
                <Stethoscope className="h-5 w-5 shrink-0 text-[var(--public-primary)]" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-[var(--public-ink)]">{item.name}</span>
                  {item.description ? <span className="line-clamp-1 block text-sm text-[var(--public-muted)]">{item.description}</span> : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}

export function PackagesSection({ packages, config, loading }: { packages: MedicalPackage[]; config?: HomePageSectionConfig; loading: boolean }) {
  if (!loading && !packages.length) return null;
  return (
    <SectionShell id="packages" title={config?.title || "Gói khám"} description={config?.description} href="/goi-kham" linkLabel="Tất cả gói khám">
      {loading ? (
        <RowSkeleton />
      ) : (
        <ul className="divide-y divide-[var(--public-divider)] overflow-hidden rounded-lg border border-[var(--public-border)] bg-[var(--public-surface)]">
          {packages.map((item) => (
            <li key={item.id}>
              <Link href={`/goi-kham/${item.slug || item.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--public-surface-muted)]">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-[var(--public-ink)]">{item.name}</span>
                  {item.summary ? <span className="line-clamp-1 block text-sm text-[var(--public-muted)]">{item.summary}</span> : null}
                  {item.isBHYTSupport ? <span className="mt-0.5 block text-xs font-semibold text-[var(--public-success)]">Hỗ trợ BHYT</span> : null}
                </span>
                <span className="shrink-0 text-right font-semibold tabular-nums text-[var(--public-primary-dark)]">{formatCurrency(item.finalPrice)}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--public-muted)]" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
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
