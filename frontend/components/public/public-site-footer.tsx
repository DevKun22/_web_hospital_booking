import { Clock3, HeartPulse, Mail, MapPin, Phone } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { SiteSettingsValue } from "@/lib/types";

const normalizeExternalUrl = (value: string) =>
  /^https?:\/\//i.test(value) ? value : `https://${value}`;

const socialLabel = (key: string) => {
  const labels: Record<string, string> = {
    facebook: "Facebook",
    youtube: "YouTube",
    zalo: "Zalo",
    linkedin: "LinkedIn",
    tiktok: "TikTok",
  };
  return labels[key.toLowerCase()] || key;
};

export function PublicSiteFooter({
  settings,
}: {
  settings: SiteSettingsValue | null;
}) {
  const hospitalName = settings?.hospitalName?.trim() || "Hospital Booking";
  const logo = settings?.logo?.trim();
  const hotline =
    settings?.hotline?.trim() ||
    settings?.emergencyHotline?.trim() ||
    "1900 0000";
  const socialLinks = Object.entries(settings?.socialLinks || {}).filter(
    ([, value]) => Boolean(value?.trim()),
  );

  return (
    <footer className="border-t border-[var(--public-divider)] bg-[var(--public-surface)] text-[var(--public-ink)]">
      <div className="ui-container grid gap-8 py-10 sm:grid-cols-2 sm:gap-10 sm:py-12 lg:grid-cols-[1.25fr_0.8fr_0.8fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-[var(--public-border)] bg-[var(--public-primary-soft)] text-[var(--public-primary)]">
              {logo ? (
                <Image src={logo} alt="" fill sizes="48px" quality={75} className="object-contain p-1.5" />
              ) : (
                <HeartPulse className="h-6 w-6" aria-hidden="true" />
              )}
            </span>
            <div>
              <p className="font-bold tracking-[-0.01em]">{hospitalName}</p>
              <p className="mt-0.5 text-xs font-medium uppercase tracking-[0.14em] text-[var(--public-muted)]">
                Chăm sóc chủ động
              </p>
            </div>
          </div>
          <p className="mt-5 max-w-md text-sm leading-7 text-[var(--public-muted)]">
            Khám phá chuyên khoa, bác sĩ và gói chăm sóc phù hợp. Đặt lịch trực tuyến và theo dõi hành trình khám bằng thông tin minh bạch.
          </p>
          {socialLinks.length ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {socialLinks.map(([key, value]) => (
                <a
                  key={key}
                  href={normalizeExternalUrl(value)}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-[var(--public-border)] px-3 py-1.5 text-xs font-semibold text-[var(--public-text-soft)] transition hover:border-[var(--public-primary)] hover:bg-[var(--public-primary-soft)] hover:text-[var(--public-primary-dark)]"
                >
                  {socialLabel(key)}
                </a>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <p className="text-sm font-bold">Khám phá</p>
          <div className="mt-4 space-y-3 text-sm text-[var(--public-muted)]">
            <Link className="block transition hover:text-[var(--public-primary)]" href="/chuyen-khoa">Chuyên khoa</Link>
            <Link className="block transition hover:text-[var(--public-primary)]" href="/bac-si">Đội ngũ bác sĩ</Link>
            <Link className="block transition hover:text-[var(--public-primary)]" href="/goi-kham">Gói khám sức khỏe</Link>
            <Link className="block transition hover:text-[var(--public-primary)]" href="/tim-kiem">Tìm kiếm dịch vụ</Link>
          </div>
        </div>

        <div>
          <p className="text-sm font-bold">Hỗ trợ</p>
          <div className="mt-4 space-y-3 text-sm text-[var(--public-muted)]">
            <Link className="block transition hover:text-[var(--public-primary)]" href="/ho-tro">Trung tâm hỗ trợ</Link>
            <Link className="block transition hover:text-[var(--public-primary)]" href="/huong-dan/dat-lich">Hướng dẫn đặt lịch</Link>
            <Link className="block transition hover:text-[var(--public-primary)]" href="/tra-cuu-lich-hen">Tra cứu lịch hẹn</Link>
            <Link className="block transition hover:text-[var(--public-primary)]" href="/hoi-dap">Câu hỏi thường gặp</Link>
          </div>
        </div>

        <div>
          <p className="text-sm font-bold">Thông tin liên hệ</p>
          <div className="mt-4 space-y-3 text-sm leading-6 text-[var(--public-muted)]">
            <a href={`tel:${hotline}`} className="flex items-start gap-2.5 transition hover:text-[var(--public-primary)]">
              <Phone className="mt-1 h-4 w-4 shrink-0 text-[var(--public-primary)]" aria-hidden="true" />
              <span>{hotline}</span>
            </a>
            {settings?.email ? (
              <a href={`mailto:${settings.email}`} className="flex items-start gap-2.5 transition hover:text-[var(--public-primary)]">
                <Mail className="mt-1 h-4 w-4 shrink-0 text-[var(--public-primary)]" aria-hidden="true" />
                <span className="break-all">{settings.email}</span>
              </a>
            ) : null}
            {settings?.workingHours ? (
              <p className="flex items-start gap-2.5">
                <Clock3 className="mt-1 h-4 w-4 shrink-0 text-[var(--public-primary)]" aria-hidden="true" />
                <span>{settings.workingHours}</span>
              </p>
            ) : null}
            {settings?.address ? (
              <p className="flex items-start gap-2.5">
                <MapPin className="mt-1 h-4 w-4 shrink-0 text-[var(--public-primary)]" aria-hidden="true" />
                <span>{settings.address}</span>
              </p>
            ) : null}
            {settings?.mapUrl ? (
              <a href={normalizeExternalUrl(settings.mapUrl)} target="_blank" rel="noreferrer" className="inline-flex font-semibold text-[var(--public-primary)] underline decoration-[var(--public-border)] underline-offset-4 transition hover:decoration-[var(--public-primary)]">
                Xem chỉ đường
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--public-divider)] bg-[var(--public-surface-muted)]">
        <div className="ui-container flex flex-col gap-2 py-5 text-xs leading-5 text-[var(--public-muted)] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {hospitalName}. Nền tảng đặt lịch và hỗ trợ người khám.</p>
          <p>Thông tin trên website không thay thế chẩn đoán hoặc tư vấn trực tiếp của bác sĩ.</p>
        </div>
      </div>
    </footer>
  );
}
