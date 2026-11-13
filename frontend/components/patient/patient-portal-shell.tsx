"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Loader2, LogOut } from "lucide-react";
import { BrandLogo } from "@/components/branding/brand-logo";
import { PublicBottomNav } from "@/components/public/public-bottom-nav";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useUnreadNotificationCount } from "@/features/portal/hooks";
import { isPortalPathActive, PORTAL_GROUPS, PORTAL_HOME, type PortalNavItem } from "@/features/portal/nav";
import { BRAND_NAME } from "@/lib/brand";
import { usePatientAuth } from "@/lib/patient-auth";

function UnreadBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-[var(--public-danger)] px-1.5 py-0.5 text-[11px] font-bold leading-none tabular-nums text-white" aria-label={`${count} thông báo chưa đọc`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

function SidebarLink({ item, pathname, unread }: { item: PortalNavItem; pathname: string; unread: number }) {
  const active = isPortalPathActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${
        active ? "bg-[var(--public-primary-soft)] font-semibold text-[var(--public-primary-dark)] shadow-[inset_3px_0_0_var(--public-primary)]" : "text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]"
      }`}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.showUnread ? <UnreadBadge count={unread} /> : null}
    </Link>
  );
}

export function PatientPortalShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, logout } = usePatientAuth();
  const unread = useUnreadNotificationCount(Boolean(user)).data ?? 0;

  useEffect(() => {
    if (!loading && !user) router.replace("/tai-khoan/dang-nhap");
  }, [loading, router, user]);

  if (loading || !user) {
    return (
      <main className="public-site flex min-h-screen items-center justify-center bg-[var(--public-canvas)] text-[var(--public-ink)]">
        <p className="flex items-center gap-3 text-sm font-semibold text-[var(--public-text-soft)]" role="status">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--public-primary)]" aria-hidden="true" />
          Đang kiểm tra phiên đăng nhập...
        </p>
      </main>
    );
  }

  const handleLogout = async () => {
    await logout();
    router.replace("/tai-khoan/dang-nhap");
  };

  return (
    <div className="public-site public-has-bottom-nav min-h-screen bg-[var(--public-canvas)] text-[var(--public-ink)]">
      <header className="sticky top-0 z-40 flex min-h-14 items-center justify-between gap-3 border-b border-[var(--public-border)] bg-[var(--public-surface)] px-4 lg:hidden">
        <Link href="/" className="flex min-w-0 items-center" aria-label={`${BRAND_NAME} - Trang chủ`}>
          <BrandLogo variant="horizontal" size="sm" />
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link href="/tai-khoan/thong-bao" className="relative flex h-11 w-11 items-center justify-center rounded-lg text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]" aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : "Thông báo"}>
            <Bell className="h-5 w-5" aria-hidden="true" />
            {unread > 0 ? <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[var(--public-danger)] ring-2 ring-[var(--public-surface)]" aria-hidden="true" /> : null}
          </Link>
        </div>
      </header>

      <div className="mx-auto grid min-h-screen max-w-[80rem] lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-screen flex-col border-r border-[var(--public-border)] bg-[var(--public-surface)] p-4 lg:flex">
          <Link href="/" className="block px-2 py-2" aria-label={`${BRAND_NAME} - Trang chủ`}>
            <BrandLogo variant="horizontal" size="md" />
          </Link>

          <nav className="mt-5 flex-1 space-y-5 overflow-y-auto" aria-label="Cổng thông tin người khám">
            <SidebarLink item={PORTAL_HOME} pathname={pathname} unread={unread} />
            {PORTAL_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="px-3 pb-1 text-xs font-semibold text-[var(--public-muted)]">{group.title}</p>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <SidebarLink key={item.href} item={item} pathname={pathname} unread={unread} />
                  ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-3 border-t border-[var(--public-divider)] pt-3">
            <p className="truncate px-3 text-sm font-semibold">{user.fullName}</p>
            <p className="truncate px-3 text-xs text-[var(--public-muted)]">{user.phone || user.email}</p>
            <div className="mt-2 flex items-center gap-1">
              <ThemeToggle />
              <button type="button" onClick={handleLogout} className="flex min-h-11 flex-1 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[var(--public-text-soft)] hover:bg-[var(--public-danger-soft)] hover:text-[var(--public-danger)]">
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Đăng xuất
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
      <PublicBottomNav />
    </div>
  );
}
