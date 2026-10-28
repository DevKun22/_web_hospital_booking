import type { Metadata } from "next";
import { PublicSiteFrame } from "@/components/public/public-site-frame";
import { buildOpenGraph } from "@/lib/seo";

const title = "Chuyên khoa";
const description = "Danh sách chuyên khoa, thông tin dịch vụ khám và đặt lịch theo chuyên khoa.";

export const metadata: Metadata = buildOpenGraph({
  title,
  description,
  path: "/departments",
  keywords: ["chuyên khoa", "đặt lịch theo chuyên khoa", "khám chuyên khoa"],
});

export default function DepartmentsLayout({ children }: { children: React.ReactNode }) {
  return <PublicSiteFrame>{children}</PublicSiteFrame>;
}
