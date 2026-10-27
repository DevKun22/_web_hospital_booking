import type { Metadata } from "next";
import { PublicSiteFrame } from "@/components/public/public-site-frame";
import { buildOpenGraph } from "@/lib/seo";

export const metadata: Metadata = buildOpenGraph({
  title: "Gói khám",
  description: "Danh sách gói khám, chi phí dự kiến, hạng mục đi kèm và đặt lịch khám trực tuyến.",
  path: "/packages",
  keywords: ["gói khám", "chi phí khám bệnh", "gói khám sức khỏe"],
});

export default function PackagesLayout({ children }: { children: React.ReactNode }) {
  return <PublicSiteFrame>{children}</PublicSiteFrame>;
}
