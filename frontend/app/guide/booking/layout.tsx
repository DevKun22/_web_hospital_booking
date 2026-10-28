import type { Metadata } from "next";
import { PublicSiteFrame } from "@/components/public/public-site-frame";
import { buildOpenGraph } from "@/lib/seo";

export const metadata: Metadata = buildOpenGraph({
  title: "Hướng dẫn đặt lịch",
  description: "Hướng dẫn các bước đặt lịch khám trực tuyến, xác thực OTP và theo dõi lịch hẹn.",
  path: "/guide/booking",
  keywords: ["hướng dẫn đặt lịch khám", "xác thực OTP", "tra cứu lịch hẹn"],
});

export default function BookingGuideLayout({ children }: { children: React.ReactNode }) {
  return <PublicSiteFrame>{children}</PublicSiteFrame>;
}
