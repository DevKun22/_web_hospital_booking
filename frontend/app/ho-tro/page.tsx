import type { Metadata } from "next";
import { FAQsClient } from "@/app/hoi-dap/faqs-client";
import { serverApiRequest } from "@/lib/server-api";
import { buildOpenGraph, jsonLdString } from "@/lib/seo";
import type { PublicFAQ, SiteSettingsValue } from "@/lib/types";

type PageProps = { searchParams: Promise<{ category?: string }> };

export const revalidate = 300;

export const metadata: Metadata = buildOpenGraph({
  title: "Trung tâm hỗ trợ người khám",
  description: "Hướng dẫn đặt lịch, giải đáp OTP, BHYT, thanh toán và các kênh hỗ trợ trực tuyến.",
  path: "/ho-tro",
  keywords: ["hướng dẫn đặt lịch khám", "hỗ trợ người khám", "câu hỏi đặt lịch", "OTP đặt lịch"],
});

async function getHelpCenterData() {
  const [faqResult, settings] = await Promise.all([
    serverApiRequest<{ items: PublicFAQ[] }>("/faqs"),
    serverApiRequest<SiteSettingsValue>("/site-settings", { next: { revalidate: 60 } }),
  ]);
  return { faqs: faqResult.items || [], settings };
}

export default async function HelpCenterPage({ searchParams }: PageProps) {
  const { category = "" } = await searchParams;
  const data = await getHelpCenterData().catch(() => ({ faqs: [], settings: null }));
  const jsonLd = data.faqs.length ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: data.faqs.slice(0, 20).map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  } : null;

  return <>
    {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} /> : null}
    <FAQsClient
      initialFAQs={data.faqs}
      initialCategory={category}
      hotline={data.settings?.hotline || data.settings?.emergencyHotline || "1900 0000"}
    />
  </>;
}
