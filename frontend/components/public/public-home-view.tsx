"use client";

import dynamic from "next/dynamic";
import { Fragment, type ReactNode } from "react";
import { BackToTopButton } from "@/components/public/back-to-top-button";
import { HomeMotion } from "@/components/public/home-motion";
import { PublicBottomNav } from "@/components/public/public-bottom-nav";
import { PublicSiteFooter } from "@/components/public/public-site-footer";
import { PublicSiteHeader } from "@/components/public/public-site-header";
import { WaveDivider } from "@/components/public/wave-divider";
import { HomeArticles } from "@/features/home/home-articles";
import { HomeHero } from "@/features/home/home-hero";
import { DepartmentsSection, DoctorsSection, PackagesSection, Partners, SupportSection } from "@/features/home/home-sections";
import { HomeProcess } from "@/components/public/home-process";
import type { PublicArticleList } from "@/lib/types";
import type { PublicHomeData } from "./public-home-types";

type PublicHomeViewProps = {
  data: PublicHomeData;
  loading: boolean;
  error: string;
  /** Bài viết mới nhất, tải trên máy chủ cùng trang; null khi chưa tải được. */
  articles?: PublicArticleList | null;
};

const ChatbotWidget = dynamic(
  () => import("@/components/chatbot/chatbot-widget").then((module) => module.ChatbotWidget),
  { ssr: false },
);

const SURFACE = "var(--public-surface)";
const CANVAS = "var(--public-canvas)";
const SOFT = "var(--public-primary-soft)";

// Mỗi mục có màu nền ở mép trên và mép dưới; hai mục liền nhau khác màu thì nối bằng đường sóng.
type Block = { key: string; top: string; bottom: string; node: ReactNode };

// Trang chủ: thông báo, đầu trang, lối tắt, rồi các mục theo cấu hình quản trị (bật/tắt, tiêu đề, số lượng).
export function PublicHomeView({ data, loading, error, articles }: PublicHomeViewProps) {
  const config = data.homeConfig;
  const sections = config?.sections;
  const limit = (value: number | undefined, fallback: number) => (value && value > 0 ? value : fallback);
  const on = (section: { enabled?: boolean } | undefined) => section?.enabled !== false;

  // Điều kiện hiện của từng mục phải khớp với chính mục đó (mục tự ẩn khi trống), để đường sóng không nối vào khoảng trống.
  const blocks: Block[] = [];
  if (on(sections?.serviceHub)) blocks.push({ key: "process", top: CANVAS, bottom: CANVAS, node: <HomeProcess /> });
  if (on(sections?.departments) && (loading || data.departments.length)) {
    blocks.push({ key: "departments", top: SURFACE, bottom: SURFACE, node: <DepartmentsSection departments={data.departments.slice(0, limit(sections?.departments.limit, 8))} config={sections?.departments} loading={loading} /> });
  }
  if (on(sections?.packages) && (loading || data.packages.length)) {
    blocks.push({ key: "packages", top: CANVAS, bottom: SOFT, node: <PackagesSection packages={data.packages.slice(0, limit(sections?.packages.limit, 3))} config={sections?.packages} loading={loading} /> });
  }
  if (on(sections?.doctors) && (loading || data.doctors.length)) {
    blocks.push({ key: "doctors", top: CANVAS, bottom: CANVAS, node: <DoctorsSection doctors={data.doctors.slice(0, limit(sections?.doctors.limit, 6))} config={sections?.doctors} loading={loading} /> });
  }
  if (articles?.items?.length) blocks.push({ key: "articles", top: SURFACE, bottom: SURFACE, node: <HomeArticles articles={articles} /> });
  if (data.faqs.length) blocks.push({ key: "faq", top: SURFACE, bottom: SURFACE, node: <SupportSection faqs={data.faqs} /> });
  if (on(sections?.partners) && data.partnerBanners.length) blocks.push({ key: "partners", top: CANVAS, bottom: CANVAS, node: <Partners banners={data.partnerBanners} config={sections?.partners} /> });

  return (
    <main id="main-content" tabIndex={-1} className="public-site public-has-bottom-nav min-h-screen bg-[var(--public-surface)] text-[var(--public-ink)]">
      <a className="ui-skip-link" href="#home-content">Bỏ qua điều hướng</a>
      <PublicSiteHeader settings={data.settings} />

      <div id="home-content" tabIndex={-1}>
        <HomeMotion />
        {error ? (
          <div className="ui-container pt-4">
            <p role="alert" className="rounded-lg border border-[var(--public-danger)] bg-[var(--public-danger-soft)] px-3 py-2.5 text-sm text-[var(--public-danger)]">{error}</p>
          </div>
        ) : null}

        <HomeHero data={data} waveFill={blocks[0]?.top ?? SURFACE} />
        {blocks.map((block, index) => {
          const previous = blocks[index - 1];
          return (
            <Fragment key={block.key}>
              {previous && previous.bottom !== block.top ? <WaveDivider from={previous.bottom} to={block.top} variant={index} /> : null}
              {block.node}
            </Fragment>
          );
        })}
      </div>

      <PublicSiteFooter settings={data.settings} />
      <BackToTopButton />
      <ChatbotWidget />
      <PublicBottomNav />
    </main>
  );
}
