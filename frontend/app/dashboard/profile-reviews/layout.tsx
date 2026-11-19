import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Duyệt hồ sơ bác sĩ",
  description: "Duyệt phần giới thiệu bác sĩ gửi lên trước khi hiển thị công khai.",
};

export default function DashboardProfileReviewsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
