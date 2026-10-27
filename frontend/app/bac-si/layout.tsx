import type { Metadata } from "next";
import { PublicSiteFrame } from "@/components/public/public-site-frame";
import { buildOpenGraph } from "@/lib/seo";

export const metadata: Metadata = buildOpenGraph({
  title: "Bác sĩ",
  description: "Tìm bác sĩ theo tên, chuyên khoa, kinh nghiệm, phí khám và lịch trống để đặt lịch trực tuyến.",
  path: "/bac-si",
  keywords: ["bác sĩ", "tìm bác sĩ", "đặt lịch bác sĩ", "lịch khám bác sĩ"],
});

export default function DoctorsLayout({ children }: { children: React.ReactNode }) {
  return <PublicSiteFrame>{children}</PublicSiteFrame>;
}
