import type { Metadata } from "next";
import { FAQsClient } from "@/app/faqs/faqs-client";
import { serverApiRequest } from "@/lib/server-api";
import { buildOpenGraph, jsonLdString } from "@/lib/seo";
import type { PublicFAQ } from "@/lib/types";

type PageProps = {
  searchParams: Promise<{ category?: string }>;
};

export const revalidate = 300;

export const metadata: Metadata = buildOpenGraph({
  title: "Câu hỏi thường gặp",
  description: "Giải đáp nhanh các câu hỏi về đặt lịch khám, bác sĩ, thanh toán, bảo hiểm và quy trình khám.",
  path: "/faqs",
  keywords: ["câu hỏi đặt lịch khám", "FAQ bệnh viện", "quy trình khám bệnh"],
});

async function getFAQs(category?: string) {
  const result = await serverApiRequest<{ items: PublicFAQ[] }>("/faqs", {
    query: { category },
  });

  return result.items || [];
}

export default async function PublicFAQsPage({ searchParams }: PageProps) {
  const { category = "" } = await searchParams;
  const faqs = await getFAQs(category || undefined).catch(() => []);
  const jsonLd = faqs.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.slice(0, 20).map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      }
    : null;

  return (
    <>
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} /> : null}
      <FAQsClient initialFAQs={faqs} initialCategory={category} />
    </>
  );
}
