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
    <footer className="border-t border-white/10 bg-[var(--public-primary-dark)] text-white">
      <div className="ui-container grid gap-10 py-12 sm:py-14 lg:grid-cols-[1.25fr_0.8fr_0.8fr_1fr]">
        <div>
          <div className="flex items-center gap-3">
            <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/10">
              {logo ? (
                <Image src={logo} alt="" fill sizes="48px" unoptimized className="object-contain p-1.5" />
              ) : (
                <HeartPulse className="h-6 w-6" aria-hidden="true" />
              )}
            </span>
            <div>
              <p className="font-bold tracking-[-0.01em]">{hospitalName}</p>
              <p className="mt-0.5 text-xs font-medium uppercase tracking-[0.14em] text-white/60">
                Chăm sóc chủ động
              </p>
            </div>
          </div>
          <p className="mt-5 max-w-md text-sm leading-7 text-white/70">
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
                  className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/76 transition hover:border-white/35 hover:bg-white/10 hover:text-white"
                >
                  {socialLabel(key)}
                </a>
              ))}
            </div>
          ) : null}
        </div>

        <div>
          <p className="text-sm font-bold text-white">Khám phá</p>
          <div className="mt-4 space-y-3 text-sm text-white/68">
            <Link className="block transition hover:text-white" href="/departments">Chuyên khoa</Link>
            <Link className="block transition hover:text-white" href="/bac-si">Đội ngũ bác sĩ</Link>
            <Link className="block transition hover:text-white" href="/packages">Gói khám sức khỏe</Link>
            <Link className="block transition hover:text-white" href="/search">Tìm kiếm dịch vụ</Link>
          </div>
        </div>

        <div>
          <p className="text-sm font-bold text-white">Hỗ trợ</p>
          <div className="mt-4 space-y-3 text-sm text-white/68">
            <Link className="block transition hover:text-white" href="/guide/booking">Hướng dẫn đặt lịch</Link>
            <Link className="block transition hover:text-white" href="/appointments/lookup">Tra cứu lịch hẹn</Link>
            <Link className="block transition hover:text-white" href="/faqs">Câu hỏi thường gặp</Link>
            <Link className="block transition hover:text-white" href="/#booking">Đặt lịch trực tuyến</Link>
          </div>
        </div>

        <div>
          <p className="text-sm font-bold text-white">Thông tin liên hệ</p>
          <div className="mt-4 space-y-3 text-sm leading-6 text-white/70">
            <a href={`tel:${hotline}`} className="flex items-start gap-2.5 transition hover:text-white">
              <Phone className="mt-1 h-4 w-4 shrink-0 text-[var(--public-accent)]" aria-hidden="true" />
              <span>{hotline}</span>
            </a>
            {settings?.email ? (
              <a href={`mailto:${settings.email}`} className="flex items-start gap-2.5 transition hover:text-white">
                <Mail className="mt-1 h-4 w-4 shrink-0 text-[var(--public-accent)]" aria-hidden="true" />
                <span className="break-all">{settings.email}</span>
              </a>
            ) : null}
            {settings?.workingHours ? (
              <p className="flex items-start gap-2.5">
                <Clock3 className="mt-1 h-4 w-4 shrink-0 text-[var(--public-accent)]" aria-hidden="true" />
                <span>{settings.workingHours}</span>
              </p>
            ) : null}
            {settings?.address ? (
              <p className="flex items-start gap-2.5">
                <MapPin className="mt-1 h-4 w-4 shrink-0 text-[var(--public-accent)]" aria-hidden="true" />
                <span>{settings.address}</span>
              </p>
            ) : null}
            {settings?.mapUrl ? (
              <a href={normalizeExternalUrl(settings.mapUrl)} target="_blank" rel="noreferrer" className="inline-flex font-semibold text-white underline decoration-white/30 underline-offset-4 transition hover:decoration-white">
                Xem chỉ đường
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="ui-container flex flex-col gap-2 py-5 text-xs leading-5 text-white/52 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {hospitalName}. Nền tảng đặt lịch và hỗ trợ người bệnh.</p>
          <p>Thông tin trên website không thay thế chẩn đoán hoặc tư vấn trực tiếp của bác sĩ.</p>
        </div>
      </div>
    </footer>
  );
}
