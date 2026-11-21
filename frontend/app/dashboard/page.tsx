"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { DsPageHeader, DsPanel } from "@/components/ds";
import { DashboardContentSkeleton } from "@/components/dashboard/dashboard-content-skeleton";
import { useAuth } from "@/lib/auth";
import { getListedDashboardItems } from "@/lib/dashboard-navigation";
import { can } from "@/lib/permissions";

// Mỗi vai trò chỉ tải phần của mình: tổng quan vận hành kéo theo thư viện biểu đồ nên không được nằm trong gói của bác sĩ hay dược sĩ.
const DoctorHome = dynamic(() => import("@/components/doctor/doctor-home").then((module) => module.DoctorHome), { loading: () => <DashboardContentSkeleton /> });
const OperationsOverview = dynamic(() => import("@/components/overview/operations-overview").then((module) => module.OperationsOverview), { loading: () => <DashboardContentSkeleton /> });
const PharmacistHome = dynamic(() => import("@/components/pharmacy/pharmacist-home").then((module) => module.PharmacistHome), { loading: () => <DashboardContentSkeleton /> });

// Trang chủ theo vai trò: bác sĩ và dược sĩ có "Việc của tôi", người có quyền xem thống kê thấy tổng quan
// vận hành; còn lại là lối tắt tới các mục được phép dùng.
export default function DashboardHome() {
  const { user } = useAuth();
  const canViewStats = can(user, "stats.view");
  const isDoctor = user?.role === "DOCTOR";
  const isPharmacy = can(user, "pharmacy.view") && !canViewStats && !isDoctor;

  const shortcuts = useMemo(
    () => (user ? getListedDashboardItems(user).filter((item) => item.href !== "/dashboard") : []),
    [user],
  );

  if (isDoctor) return <DoctorHome />;
  if (canViewStats) return <OperationsOverview />;
  if (isPharmacy) return <PharmacistHome />;

  return (
    <>
      <DsPageHeader
        title={`Xin chào, ${user?.fullName || "bạn"}`}
        description="Chọn một mục để bắt đầu. Thống kê tổng quan chỉ dành cho tài khoản được cấp quyền xem."
      />
      <DsPanel title="Lối tắt" flush>
        {shortcuts.length ? (
          shortcuts.map((item) => (
            <Link key={item.key} href={item.href} className="ds-todo" style={{ color: "inherit", textDecoration: "none" }}>
              <div className="ds-todo__text">
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </div>
              <span className="ds-link">Mở</span>
            </Link>
          ))
        ) : (
          <p style={{ margin: 0, padding: "20px 16px", color: "var(--ds-muted)" }}>Tài khoản chưa được cấp quyền vào mục nào.</p>
        )}
      </DsPanel>
    </>
  );
}
