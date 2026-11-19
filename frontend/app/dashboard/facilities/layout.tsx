import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cơ sở khám",
  description: "Quản lý các địa điểm khám và cơ sở mặc định.",
};

export default function DashboardFacilitiesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
