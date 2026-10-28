import type { Metadata } from "next";
import { PublicSiteFrame } from "@/components/public/public-site-frame";
import { buildOpenGraph } from "@/lib/seo";

export const metadata: Metadata = buildOpenGraph({
  title: "Bác sĩ",
  description: "Danh sách bác sĩ, chuyên khoa, phí khám và lịch khám trống để đặt lịch trực tuyến.",
  path: "/bac-si",
  keywords: ["bác sĩ", "đặt lịch bác sĩ", "lịch khám bác sĩ"],
});

export default function DoctorsLayout({ children }: { children: React.ReactNode }) {
  return <PublicSiteFrame>{children}</PublicSiteFrame>;
}
