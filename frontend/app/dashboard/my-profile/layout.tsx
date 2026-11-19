import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hồ sơ giới thiệu",
  description: "Soạn phần giới thiệu công khai của bác sĩ và gửi quản trị duyệt.",
};

export default function DashboardMyProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
