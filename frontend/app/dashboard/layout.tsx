import type { Metadata } from "next";
import { DashboardAuthLayout } from "@/components/dashboard/dashboard-auth-layout";
import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata({
  title: "Tổng quan quản trị",
  description: "Dashboard quản trị lịch hẹn, bác sĩ, chuyên khoa, hóa đơn và nội dung website.",
});

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardAuthLayout>{children}</DashboardAuthLayout>;
}
