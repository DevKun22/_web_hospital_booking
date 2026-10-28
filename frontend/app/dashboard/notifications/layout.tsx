import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trung tâm thông báo",
  description: "Quản lý chiến dịch thông báo và lịch sử gửi thông báo đến ứng dụng người bệnh.",
};

export default function DashboardNotificationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
