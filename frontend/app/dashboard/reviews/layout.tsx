import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Đánh giá người bệnh",
  description: "Theo dõi và kiểm duyệt đánh giá về bác sĩ, dịch vụ và cơ sở khám.",
};

export default function DashboardReviewsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
