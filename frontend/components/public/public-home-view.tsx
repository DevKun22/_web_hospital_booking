"use client";

import dynamic from "next/dynamic";
import { BackToTopButton } from "@/components/public/back-to-top-button";
import { PublicBottomNav } from "@/components/public/public-bottom-nav";
import { PublicSiteFooter } from "@/components/public/public-site-footer";
import { PublicSiteHeader } from "@/components/public/public-site-header";
import { Benefits, ClosingCta, DepartmentsSection, DoctorsSection, FaqSection, Hero, Notice, PackagesSection, Partners, Steps } from "@/features/home/home-sections";
import type { PublicHomeData } from "./public-home-types";

type PublicHomeViewProps = {
  data: PublicHomeData;
  loading: boolean;
  error: string;
};

const PublicChatbotWidget = dynamic(
  () => import("@/components/public/public-chatbot-widget").then((module) => module.PublicChatbotWidget),
  { ssr: false },
);

// Trang chủ: thông báo, đầu trang, lối tắt, rồi các mục theo cấu hình quản trị (bật/tắt, tiêu đề, số lượng).
export function PublicHomeView({ data, loading, error }: PublicHomeViewProps) {
  const config = data.homeConfig;
  const sections = config?.sections;
  const limit = (value: number | undefined, fallback: number) => (value && value > 0 ? value : fallback);

  return (
    <main id="main-content" tabIndex={-1} className="public-site public-has-bottom-nav min-h-screen bg-[var(--public-surface)] text-[var(--public-ink)]">
      <a className="ui-skip-link" href="#home-content">Bỏ qua điều hướng</a>
      <PublicSiteHeader settings={data.settings} />
      <Notice announcement={config?.announcement} />

      <div id="home-content" tabIndex={-1}>
        {error ? (
          <div className="ui-container pt-4">
            <p role="alert" className="rounded-lg border border-[var(--public-danger)] bg-[var(--public-danger-soft)] px-3 py-2.5 text-sm text-[var(--public-danger)]">{error}</p>
          </div>
        ) : null}

        <Hero settings={data.settings} banner={data.heroBanners[0]} departments={data.departments} />
        {sections?.serviceHub.enabled !== false ? <Benefits /> : null}
        {sections?.doctors.enabled !== false ? (
          <DoctorsSection doctors={data.doctors.slice(0, limit(sections?.doctors.limit, 4))} config={sections?.doctors} loading={loading} />
        ) : null}
        {sections?.departments.enabled !== false ? (
          <DepartmentsSection departments={data.departments.slice(0, limit(sections?.departments.limit, 9))} config={sections?.departments} loading={loading} />
        ) : null}
        {sections?.packages.enabled !== false ? (
          <PackagesSection packages={data.packages.slice(0, limit(sections?.packages.limit, 4))} config={sections?.packages} loading={loading} />
        ) : null}
        <Steps />
        <FaqSection faqs={data.faqs} />
        {sections?.partners.enabled !== false ? <Partners banners={data.partnerBanners} config={sections?.partners} /> : null}
        <ClosingCta settings={data.settings} />
      </div>

      <PublicSiteFooter settings={data.settings} />
      <BackToTopButton />
      <PublicChatbotWidget />
      <PublicBottomNav />
    </main>
  );
}
