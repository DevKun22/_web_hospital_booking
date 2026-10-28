import type { Metadata } from "next";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata({
  title: "Đăng nhập quản trị",
  description: "Đăng nhập dashboard quản trị hệ thống đặt lịch khám bằng OTP bảo mật.",
});

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
