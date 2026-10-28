import type { Metadata } from "next";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata({
  title: "Kiểm tra thanh toán",
  description: "Quay lại hệ thống để kiểm tra trạng thái thanh toán hóa đơn.",
});

export default function PaymentReturnLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
