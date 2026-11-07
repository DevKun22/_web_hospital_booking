import type { Metadata } from "next";
import { PublicSiteFrame } from "@/components/public/public-site-frame";
import { buildOpenGraph } from "@/lib/seo";

export const metadata: Metadata = buildOpenGraph({
  title: "Đặt lịch khám",
  description: "Chọn dịch vụ, thời gian khám, nhập thông tin và xác thực OTP theo từng bước.",
  path: "/dat-lich",
  keywords: ["đặt lịch khám", "đặt lịch bác sĩ", "đăng ký khám trực tuyến"],
});

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return <PublicSiteFrame>{children}</PublicSiteFrame>;
}
