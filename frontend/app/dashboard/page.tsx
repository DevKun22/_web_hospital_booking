"use client";

import { useMemo } from "react";
import Link from "next/link";
import { DsPageHeader, DsPanel } from "@/components/ds";
import { DoctorHome } from "@/components/doctor/doctor-home";
import { OperationsOverview } from "@/components/overview/operations-overview";
import { PharmacistHome } from "@/components/pharmacy/pharmacist-home";
import { useAuth } from "@/lib/auth";
import { getListedDashboardItems } from "@/lib/dashboard-navigation";
import { can } from "@/lib/permissions";

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
