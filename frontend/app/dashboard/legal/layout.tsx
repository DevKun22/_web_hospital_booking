import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Điều khoản",
  description: "Soạn điều khoản sử dụng và chính sách bảo mật hiển thị cho người khám.",
};

export default function DashboardLegalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
