import { CalendarCheck, Clock3, Mail, Phone } from "lucide-react";
import Link from "next/link";
import { BrandLogo } from "@/components/branding/brand-logo";
import { FooterAskKun } from "@/components/public/footer-ask-kun";
import { FooterFacilities } from "@/components/public/footer-facilities";
import { BRAND_NAME } from "@/lib/brand";
import type { SiteSettingsValue } from "@/lib/types";

const normalizeExternalUrl = (value: string) => (/^https?:\/\//i.test(value) ? value : `https://${value}`);

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

/** Số cấp cứu y tế toàn quốc. */
const EMERGENCY_NUMBER = "115";

const linkClass = "block py-1 text-white/80 transition hover:text-white hover:underline hover:underline-offset-4";

const LINK_GROUPS = [
  {
    title: "Khám phá",
    links: [
      { href: "/chuyen-khoa", label: "Chuyên khoa" },
      { href: "/bac-si", label: "Đội ngũ bác sĩ" },
      { href: "/goi-kham", label: "Gói khám sức khỏe" },
      { href: "/kien-thuc", label: "Kiến thức sức khỏe" },
      { href: "/tim-kiem", label: "Tìm kiếm dịch vụ" },
    ],
  },
  {
    title: "Hỗ trợ",
    links: [
      { href: "/ho-tro", label: "Trung tâm hỗ trợ" },
      { href: "/huong-dan/dat-lich", label: "Hướng dẫn đặt lịch" },
      { href: "/tai-khoan/dang-nhap?next=/tai-khoan/lich-hen", label: "Tra cứu lịch hẹn" },
      { href: "/hoi-dap", label: "Câu hỏi thường gặp" },
    ],
  },
  {
    title: "Thông tin",
    links: [
      { href: "/dieu-khoan", label: "Điều khoản sử dụng" },
      { href: "/chinh-sach-bao-mat", label: "Chính sách bảo mật" },
      { href: "/thuong-hieu", label: "Bộ nhận diện" },
    ],
  },
] as const;

// Footer công khai: nền xanh đậm; dải mời đặt lịch hoặc hỏi Kun, năm cột (giới thiệu và liên hệ, khám phá, hỗ trợ, thông tin pháp lý, địa điểm khám)
// và thanh dưới cùng có lưu ý y khoa kèm số cấp cứu. Liên hệ chỉ hiện khi cơ sở đã cấu hình; không dùng số điện thoại giả để lấp chỗ trống.
export function PublicSiteFooter({ settings }: { settings: SiteSettingsValue | null }) {
  const hospitalName = settings?.hospitalName?.trim() || BRAND_NAME;
  const hotline = settings?.hotline?.trim() || settings?.emergencyHotline?.trim() || "";
  const socialLinks = Object.entries(settings?.socialLinks || {}).filter(([, value]) => Boolean(value?.trim()));

  return (
    <footer className="bg-[linear-gradient(180deg,var(--footer-from)_0%,var(--footer-to)_100%)] text-white">
      <div className="ui-container pt-10 sm:pt-12">
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl bg-white/10 p-5 sm:flex-row sm:items-center sm:p-6">
          <div>
            <p className="text-lg font-semibold">Cần đặt lịch khám?</p>
            <p className="mt-1 text-sm text-white/80">Chọn bác sĩ và giờ còn trống, hoặc hỏi Kun để được gợi ý chuyên khoa.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/dat-lich" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--hero-btn-bg)] px-6 text-base font-semibold text-[var(--hero-btn-fg)] transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              <CalendarCheck className="h-5 w-5" aria-hidden="true" />
              Đặt lịch khám
            </Link>
            <FooterAskKun />
          </div>
        </div>
      </div>

      <div className="ui-container grid gap-8 py-10 sm:grid-cols-2 sm:gap-10 sm:py-12 lg:grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr_1.2fr]">
        <div className="sm:col-span-2 lg:col-span-1">
          <BrandLogo variant="light" size="lg" />
          <p className="mt-5 max-w-md text-sm leading-7 text-white/80">
            Khám phá chuyên khoa, bác sĩ và gói chăm sóc phù hợp. Đặt lịch trực tuyến và theo dõi hành trình khám bằng thông tin minh bạch.
          </p>
          <ul className="mt-5 space-y-2.5 text-sm text-white/80">
            {hotline ? (
              <li>
                <a href={`tel:${hotline}`} className="inline-flex items-center gap-2.5 transition hover:text-white">
                  <Phone className="h-4 w-4 shrink-0 text-[var(--footer-accent)]" aria-hidden="true" />
                  <span className="tabular-nums">{hotline}</span>
                </a>
              </li>
            ) : null}
            {settings?.email ? (
              <li>
                <a href={`mailto:${settings.email}`} className="inline-flex items-center gap-2.5 transition hover:text-white">
                  <Mail className="h-4 w-4 shrink-0 text-[var(--footer-accent)]" aria-hidden="true" />
                  <span className="break-all">{settings.email}</span>
                </a>
              </li>
            ) : null}
            {settings?.workingHours ? (
              <li className="flex items-start gap-2.5">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--footer-accent)]" aria-hidden="true" />
                <span>{settings.workingHours}</span>
              </li>
            ) : null}
          </ul>
          {socialLinks.length ? (
            <ul className="mt-5 flex flex-wrap gap-2" aria-label="Mạng xã hội">
              {socialLinks.map(([key, value]) => (
                <li key={key}>
                  <a
                    href={normalizeExternalUrl(value)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-9 items-center rounded-full border border-white/40 px-3.5 text-xs font-medium text-white transition hover:bg-white/15"
                  >
                    {socialLabel(key)}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {LINK_GROUPS.map((group) => (
          <nav key={group.title} aria-label={group.title}>
            <p className="text-sm font-semibold text-white">{group.title}</p>
            <ul className="mt-4 text-sm">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClass}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <FooterFacilities fallbackAddress={settings?.address} fallbackMapUrl={settings?.mapUrl} />
      </div>

      <div className="border-t border-white/15 bg-black/20">
        <div className="ui-container flex flex-col gap-2 py-5 text-xs leading-5 text-white/80 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {hospitalName}. Thông tin trên website không thay thế chẩn đoán hoặc tư vấn trực tiếp của bác sĩ.</p>
          <p>
            Trường hợp cấp cứu, gọi{" "}
            <a href={`tel:${EMERGENCY_NUMBER}`} className="font-semibold text-white underline underline-offset-4">{EMERGENCY_NUMBER}</a>{" "}
            hoặc đến cơ sở y tế gần nhất.
          </p>
        </div>
      </div>
    </footer>
  );
}
