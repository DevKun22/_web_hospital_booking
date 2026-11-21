import type { Metadata } from "next";
import Link from "next/link";
import { Clock, HelpCircle, Mail, MapPin, Phone, Route } from "lucide-react";
import { AskKunButton } from "@/components/public/ask-kun-button";
import { CatalogHeader } from "@/components/public/catalog-parts";
import { serverApiRequest } from "@/lib/server-api";
import { buildOpenGraph } from "@/lib/seo";
import type { SiteSettingsValue } from "@/lib/types";

export const revalidate = 300;

export const metadata: Metadata = buildOpenGraph({
  title: "Liên hệ và hỗ trợ",
  description: "Đường dây hỗ trợ, email, giờ làm việc và địa chỉ các cơ sở khám; hướng dẫn đặt lịch và câu hỏi thường gặp.",
  path: "/ho-tro",
  keywords: ["liên hệ cơ sở khám", "địa điểm khám", "hỗ trợ đặt lịch", "hotline"],
});

type PublicFacility = { id: string; name: string; address: string | null; phone: string | null; workingHours: string | null; mapUrl: string | null; isDefault: boolean };

async function load() {
  const [settings, facilities] = await Promise.all([
    serverApiRequest<SiteSettingsValue>("/site-settings", { next: { revalidate: 60 } }).catch(() => null),
    serverApiRequest<PublicFacility[]>("/facilities", { next: { revalidate: 300 } }).catch(() => [] as PublicFacility[]),
  ]);
  return { settings, facilities };
}

const CARD = "rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] p-4";
const isWebUrl = (value: string | null | undefined): value is string => Boolean(value && /^https?:\/\//i.test(value));

function ContactCard({ icon: Icon, label, children }: { icon: typeof Phone; label: string; children: React.ReactNode }) {
  return (
    <div className={`${CARD} flex items-start gap-3`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--public-primary-soft)] text-[var(--public-primary)]">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-[var(--public-muted)]">{label}</p>
        {children}
      </div>
    </div>
  );
}

export default async function SupportPage() {
  const { settings, facilities } = await load();
  const hotline = settings?.hotline?.trim();
  const emergency = settings?.emergencyHotline?.trim();
  const email = settings?.email?.trim();
  const hours = settings?.workingHours?.trim();
  const hasContact = Boolean(hotline || email || hours);

  return (
    <main className="min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">
      <CatalogHeader current="Liên hệ và hỗ trợ" title="Liên hệ và hỗ trợ" description="Gọi, nhắn hoặc đến trực tiếp cơ sở khám. Cần biết cách đặt lịch thì xem hướng dẫn bên dưới." />

      <section className="ui-container space-y-8 py-6 sm:py-8">
        {hasContact ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {hotline ? (
              <ContactCard icon={Phone} label="Đường dây hỗ trợ">
                <a href={`tel:${hotline.replace(/\s+/g, "")}`} className="text-lg font-bold tabular-nums text-[var(--public-primary-dark)]">{hotline}</a>
                {emergency ? <p className="text-sm text-[var(--public-text-soft)]">Cấp cứu: <a href={`tel:${emergency.replace(/\s+/g, "")}`} className="font-semibold underline underline-offset-4">{emergency}</a></p> : null}
              </ContactCard>
            ) : null}
            {email ? (
              <ContactCard icon={Mail} label="Email">
                <a href={`mailto:${email}`} className="break-all text-base font-semibold text-[var(--public-primary-dark)]">{email}</a>
              </ContactCard>
            ) : null}
            {hours ? (
              <ContactCard icon={Clock} label="Giờ làm việc">
                <p className="whitespace-pre-line text-base font-semibold">{hours}</p>
              </ContactCard>
            ) : null}
          </div>
        ) : null}

        {facilities.length ? (
          <section aria-labelledby="facilities-heading">
            <h2 id="facilities-heading" className="mb-3 text-lg font-bold">Cơ sở khám</h2>
            <ul className="divide-y divide-[var(--public-divider)] overflow-hidden rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)]">
              {facilities.map((facility) => (
                <li key={facility.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 font-semibold"><MapPin className="h-4 w-4 shrink-0 text-[var(--public-primary)]" aria-hidden="true" />{facility.name}</p>
                    {facility.address ? <p className="mt-0.5 text-sm text-[var(--public-text-soft)]">{facility.address}</p> : null}
                    <p className="mt-0.5 text-sm text-[var(--public-muted)]">
                      {[facility.workingHours, facility.phone].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {isWebUrl(facility.mapUrl) ? (
                    <a href={facility.mapUrl} target="_blank" rel="noopener noreferrer" className="public-button-secondary inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold">
                      Xem bản đồ
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : settings?.address ? (
          <section aria-labelledby="address-heading">
            <h2 id="address-heading" className="mb-3 text-lg font-bold">Địa chỉ</h2>
            <p className={CARD}>{settings.address}</p>
          </section>
        ) : null}

        <section aria-labelledby="help-heading">
          <h2 id="help-heading" className="mb-3 text-lg font-bold">Cần giúp gì?</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Link href="/huong-dan/dat-lich" className={`${CARD} block hover:bg-[var(--public-surface-muted)]`}>
              <Route className="h-5 w-5 text-[var(--public-primary)]" aria-hidden="true" />
              <p className="mt-2 font-semibold">Hướng dẫn đặt lịch</p>
              <p className="text-sm text-[var(--public-text-soft)]">Sáu bước, mất chừng một phút.</p>
            </Link>
            <Link href="/hoi-dap" className={`${CARD} block hover:bg-[var(--public-surface-muted)]`}>
              <HelpCircle className="h-5 w-5 text-[var(--public-primary)]" aria-hidden="true" />
              <p className="mt-2 font-semibold">Câu hỏi thường gặp</p>
              <p className="text-sm text-[var(--public-text-soft)]">Đặt lịch, chi phí, bảo hiểm.</p>
            </Link>
            <div className={CARD}>
              <p className="font-semibold">Hỏi trợ lý</p>
              <p className="mb-3 text-sm text-[var(--public-text-soft)]">Định hướng chuyên khoa hoặc gói khám.</p>
              <AskKunButton label="Hỏi trợ lý" />
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
