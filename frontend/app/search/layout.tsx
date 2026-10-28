import type { Metadata } from "next";
import { PublicSiteFrame } from "@/components/public/public-site-frame";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata({
  title: "Tìm kiếm",
  description: "Tìm kiếm chuyên khoa, bác sĩ, gói khám và câu hỏi thường gặp.",
  follow: true,
});

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return <PublicSiteFrame>{children}</PublicSiteFrame>;
}
