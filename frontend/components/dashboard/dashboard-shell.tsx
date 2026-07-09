"use client";

/* eslint-disable @next/next/no-img-element */

import {
  Bot,
  Building2,
  CalendarCheck,
  CalendarClock,
  FileText,
  Hospital,
  Images,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Pill,
  Receipt,
  Star,
  Settings,
  Stethoscope,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { usePublicSiteSettings } from "@/lib/public-home-query";
import type { DashboardRole } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: DashboardRole[];
};

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Tổng quan",
    icon: LayoutDashboard,
    roles: ["ADMIN", "STAFF", "DOCTOR"],
  },
  {
    href: "/dashboard/departments",
    label: "Chuyên khoa",
    icon: Building2,
    roles: ["ADMIN", "STAFF"],
  },
  {
    href: "/dashboard/doctors",
    label: "Bác sĩ",
    icon: Stethoscope,
    roles: ["ADMIN", "STAFF"],
  },
  {
    href: "/dashboard/packages",
    label: "Gói khám",
    icon: Package,
    roles: ["ADMIN", "STAFF"],
  },
  {
    href: "/dashboard/schedules",
    label: "Lịch bác sĩ",
    icon: CalendarClock,
    roles: ["ADMIN", "STAFF", "DOCTOR"],
  },
  {
    href: "/dashboard/appointments",
    label: "Lịch hẹn",
    icon: CalendarCheck,
    roles: ["ADMIN", "STAFF", "DOCTOR"],
  },
  {
    href: "/dashboard/consultation-requests",
    label: "Yêu cầu tư vấn",
    icon: MessageSquareText,
    roles: ["ADMIN", "STAFF"],
  },
  {
    href: "/dashboard/reviews",
    label: "Đánh giá",
    icon: Star,
    roles: ["ADMIN", "STAFF", "DOCTOR"],
  },
  {
    href: "/dashboard/invoices",
    label: "Hoá đơn",
    icon: Receipt,
    roles: ["ADMIN", "STAFF"],
  },
  {
    href: "/dashboard/medical-records",
    label: "Hồ sơ khám",
    icon: FileText,
    roles: ["ADMIN", "STAFF", "DOCTOR"],
  },
  {
    href: "/dashboard/prescriptions",
    label: "Đơn thuốc",
    icon: Pill,
    roles: ["ADMIN", "STAFF", "DOCTOR"],
  },
  {
    href: "/dashboard/chatbot",
    label: "Chatbot",
    icon: Bot,
    roles: ["ADMIN", "STAFF"],
  },
  {
    href: "/dashboard/uploads",
    label: "Thư viện ảnh",
    icon: Images,
    roles: ["ADMIN", "STAFF"],
  },
  { href: "/dashboard/users", label: "Nhân sự", icon: Users, roles: ["ADMIN"] },
  {
    href: "/dashboard/site-settings",
    label: "Cấu hình website",
    icon: Settings,
    roles: ["ADMIN", "STAFF"],
  },
];

const roleLabel: Record<DashboardRole, string> = {
  ADMIN: "Quản trị",
  STAFF: "Nhân viên",
  DOCTOR: "Bác sĩ",
};

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const siteSettingsQuery = usePublicSiteSettings();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const visibleItems = navItems.filter(
    (item) => user && item.roles.includes(user.role),
  );
  const SidebarToggleIcon = sidebarCollapsed ? PanelLeftOpen : PanelLeftClose;
  const siteSettings = siteSettingsQuery.data || null;
  const hospitalName = siteSettings?.hospitalName?.trim() || "Hospital Booking";
  const logo = siteSettings?.logo?.trim();

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen]);

  return (
    <div className="dashboard-shell min-h-screen bg-[var(--background)] text-[var(--foreground)] transition-colors">
      <aside
        className={`fixed inset-y-0 left-0 hidden h-dvh flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--surface)] transition-[width] duration-200 ease-out will-change-[width] lg:flex ${sidebarCollapsed ? "w-20" : "w-68"}`}
      >
        <div
          className={`flex h-18 items-center border-b border-[var(--border-soft)] ${sidebarCollapsed ? "justify-center px-3" : "gap-3 px-6"}`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--primary-soft)] text-[var(--primary)]">
            {logo ? (
              <img
                src={logo}
                alt={hospitalName}
                className="h-full w-full object-contain p-1"
              />
            ) : (
              <Hospital className="h-5 w-5" aria-hidden="true" />
            )}
          </div>
          <div
            className={`min-w-0 flex-1 overflow-hidden ${sidebarCollapsed ? "hidden" : "block"}`}
          >
            <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Dashboard
            </p>
            <h1 className="truncate text-lg font-semibold" title={hospitalName}>
              {hospitalName}
            </h1>
          </div>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((current) => !current)}
            className={`${sidebarCollapsed ? "hidden" : "inline-flex"} h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-soft)] transition-colors duration-150 hover:bg-[var(--surface-soft)]`}
            aria-label={
              sidebarCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"
            }
            title={sidebarCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
          >
            <SidebarToggleIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <nav
          className={`min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain py-4 [scrollbar-gutter:stable] ${sidebarCollapsed ? "px-2" : "px-3"}`}
          aria-label="Điều hướng dashboard"
        >
          {visibleItems.map((item) => {
            const active =
              item.href === "/dashboard"
                ? pathname === item.href
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={sidebarCollapsed ? item.label : undefined}
                className={`flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${sidebarCollapsed ? "justify-center gap-0" : "gap-3"} ${
                  active
                    ? "bg-[var(--primary-soft)] text-[var(--primary)] shadow-[inset_3px_0_0_var(--primary)]"
                    : "text-[var(--text-soft)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span
                  className={sidebarCollapsed ? "sr-only" : "block truncate"}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
            aria-label="Đóng điều hướng"
          />
          <aside
            className="relative flex h-dvh w-[min(21rem,88vw)] flex-col border-r border-[var(--border)] bg-[var(--surface)] shadow-2xl"
            aria-label="Điều hướng dashboard trên mobile"
          >
            <div className="flex min-h-16 items-center gap-3 border-b border-[var(--border-soft)] px-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
                {logo ? <img src={logo} alt={hospitalName} className="h-full w-full object-contain p-1" /> : <Hospital className="h-5 w-5" aria-hidden="true" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Dashboard</p>
                <p className="truncate font-semibold">{hospitalName}</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[var(--text-muted)] hover:bg-[var(--surface-soft)]"
                aria-label="Đóng menu"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
              {visibleItems.map((item) => {
                const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${active ? "bg-[var(--primary-soft)] text-[var(--primary)]" : "text-[var(--text-soft)] hover:bg-[var(--surface-soft)]"}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        </div>
      ) : null}

      <div
        className={`transition-[padding] duration-200 ease-out ${sidebarCollapsed ? "lg:pl-20" : "lg:pl-68"}`}
      >
        <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)] backdrop-blur transition-colors">
          <div className="flex min-h-18 items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-soft)] hover:bg-[var(--surface-soft)] lg:hidden"
              aria-label="Mở menu dashboard"
              aria-expanded={mobileOpen}
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            {sidebarCollapsed ? (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-soft)] transition-colors duration-150 hover:bg-[var(--surface-soft)] lg:inline-flex"
                aria-label="Mở lại sidebar"
                title="Mở lại sidebar"
              >
                <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
            <div className="min-w-0">
              <p className="truncate text-sm text-[var(--text-muted)]">
                Hệ thống quản trị đặt lịch khám
              </p>
              <p
                className="truncate text-lg font-semibold"
                title={hospitalName}
              >
                {hospitalName}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold">{user?.fullName}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {user ? roleLabel[user.role] : "Đang tải"}
                </p>
              </div>
              <button
                onClick={() => void logout()}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm font-medium text-[var(--text-soft)] hover:bg-[var(--surface-soft)]"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Đăng xuất</span>
              </button>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
