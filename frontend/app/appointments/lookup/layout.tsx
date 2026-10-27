import type { Metadata } from "next";
import { PublicSiteFrame } from "@/components/public/public-site-frame";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata({
  title: "Tra cứu lịch hẹn",
  description:
    "Tra cứu mã lịch hẹn, xác thực OTP, theo dõi trạng thái khám, kết quả và thanh toán.",
});

export default function AppointmentLookupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PublicSiteFrame>{children}</PublicSiteFrame>;
}
