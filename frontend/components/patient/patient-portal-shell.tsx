"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, CalendarDays, FileHeart, HeartPulse, Home, Loader2, LogOut, Menu, ReceiptText, ShieldCheck, UsersRound } from "lucide-react";
import { usePatientAuth } from "@/lib/patient-auth";
import { patientPortalRequest } from "@/lib/patient-portal-api";
import { usePublicSiteSettings } from "@/lib/public-home-query";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const nav = [
  { href: "/tai-khoan", label: "Tổng quan", icon: Home },
  { href: "/tai-khoan/lich-hen", label: "Lịch hẹn", icon: CalendarDays },
  { href: "/tai-khoan/ho-so", label: "Hồ sơ cá nhân", icon: UsersRound },
  { href: "/tai-khoan/ho-so-suc-khoe", label: "Kết quả và đơn thuốc", icon: FileHeart },
  { href: "/tai-khoan/hoa-don", label: "Hóa đơn", icon: ReceiptText },
  { href: "/tai-khoan/thong-bao", label: "Thông báo", icon: Bell, showUnread: true },
  { href: "/tai-khoan/bao-mat", label: "Bảo mật", icon: ShieldCheck },
] as const;

export function PatientPortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, logout } = usePatientAuth();
  const settings = usePublicSiteSettings().data;
  const unreadQuery = useQuery({
    queryKey: ["patient-notifications-unread-count"],
    queryFn: async () => (await patientPortalRequest<{ unreadCount: number }>("/thong-bao/so-chua-doc")).data.unreadCount,
    enabled: Boolean(user),
    staleTime: 30_000,
    refetchInterval: 3 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const hospitalName = settings?.hospitalName?.trim() || "Hospital Booking";
  const isActive = (href: string) => href === "/tai-khoan" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    if (!loading && !user) router.replace("/tai-khoan/dang-nhap");
  }, [loading, router, user]);

  if (loading || !user) {
    return <main className="public-site flex min-h-screen items-center justify-center bg-[var(--public-canvas)] text-[var(--public-ink)]"><div className="flex items-center gap-3 text-sm font-semibold text-[var(--public-text-soft)]"><Loader2 className="h-5 w-5 animate-spin text-[var(--public-primary)]" /> Đang kiểm tra phiên đăng nhập...</div></main>;
  }

  const handleLogout = async () => {
    await logout();
    router.replace("/tai-khoan/dang-nhap");
  };

  return (
    <div className="public-site min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">
      <header className="sticky top-0 z-40 border-b border-[var(--public-border)] bg-[var(--public-surface)] backdrop-blur-xl lg:hidden">
        <div className="flex min-h-16 items-center justify-between gap-3 px-4">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--public-primary-soft)] text-[var(--public-primary)]">{settings?.logo ? <Image src={settings.logo} alt="" fill sizes="36px" className="object-contain p-1" /> : <HeartPulse className="h-5 w-5" />}</span>
            <span className="truncate text-sm font-bold">{hospitalName}</span>
          </Link>
          <div className="flex items-center gap-2"><ThemeToggle /><button type="button" onClick={() => setMobileOpen((value) => !value)} className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--public-border)]" aria-label="Mở điều hướng" aria-expanded={mobileOpen}><Menu className="h-5 w-5" /></button></div>
        </div>
        {mobileOpen ? <nav className="border-t border-[var(--public-border)] bg-[var(--public-surface)] px-4 py-3 shadow-lg" aria-label="Cổng người khám"><div className="grid grid-cols-2 gap-2">{nav.map((item) => <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} aria-current={isActive(item.href) ? "page" : undefined} className={`flex min-h-11 items-center gap-2 rounded-xl px-3 text-xs font-semibold ${isActive(item.href) ? "bg-[var(--public-primary-soft)] text-[var(--public-primary-dark)]" : "bg-[var(--public-surface-muted)] text-[var(--public-text-soft)]"}`}><item.icon className="h-4 w-4" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{item.label}</span>{"showUnread" in item && item.showUnread && (unreadQuery.data || 0) > 0 ? <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white" aria-label={`${unreadQuery.data} thông báo chưa đọc`}>{Math.min(unreadQuery.data || 0, 99)}{(unreadQuery.data || 0) > 99 ? "+" : ""}</span> : null}</Link>)}</div><button type="button" onClick={handleLogout} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-200 text-sm font-semibold text-red-700"><LogOut className="h-4 w-4" /> Đăng xuất</button></nav> : null}
      </header>

      <div className="mx-auto grid min-h-screen max-w-[92rem] lg:grid-cols-[16.5rem_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-screen flex-col border-r border-[var(--public-border)] bg-[var(--public-surface)] p-4 lg:flex">
          <Link href="/" className="flex min-w-0 items-center gap-3 px-2 py-3"><span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[var(--public-primary-soft)] text-[var(--public-primary)]">{settings?.logo ? <Image src={settings.logo} alt="" fill sizes="44px" className="object-contain p-1" /> : <HeartPulse className="h-6 w-6" />}</span><span className="min-w-0"><span className="block truncate text-sm font-bold">{hospitalName}</span><span className="block text-[11px] text-[var(--public-muted)]">Cổng người khám</span></span></Link>
          <nav className="mt-5 space-y-1" aria-label="Cổng thông tin người khám">{nav.map((item) => <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${isActive(item.href) ? "bg-[var(--public-primary-soft)] text-[var(--public-primary-dark)]" : "text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]"}`}><item.icon className="h-4 w-4" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{item.label}</span>{"showUnread" in item && item.showUnread && (unreadQuery.data || 0) > 0 ? <span role="status" aria-atomic="true" className="inline-flex min-w-6 shrink-0 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white" aria-label={`${unreadQuery.data} thông báo chưa đọc`}>{Math.min(unreadQuery.data || 0, 99)}{(unreadQuery.data || 0) > 99 ? "+" : ""}</span> : null}</Link>)}</nav>
          <ThemeToggle showLabel className="mt-auto w-full" />
          <div className="mt-3 rounded-2xl bg-[var(--public-primary-dark)] p-4 text-white"><ShieldCheck className="h-5 w-5" /><p className="mt-3 text-sm font-bold">Dữ liệu được bảo vệ</p><p className="mt-1 text-xs leading-5 text-blue-100">Phiên đăng nhập được xác thực và có thể thu hồi khi cần.</p></div>
          <button type="button" onClick={handleLogout} className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--public-border)] text-sm font-semibold text-[var(--public-text-soft)] hover:bg-red-50 hover:text-red-700"><LogOut className="h-4 w-4" /> Đăng xuất</button>
        </aside>
        <main className="min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</main>
      </div>
    </div>
  );
}

