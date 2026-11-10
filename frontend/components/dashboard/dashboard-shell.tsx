"use client";

/* eslint-disable @next/next/no-img-element */

import {
  Bell,
  ChevronDown,
  ChevronRight,
  Hospital,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Dialog } from "radix-ui";
import {
  DsButton,
  DsDrawer,
  DsMenu,
  DsMenuItem,
  DsMenuLabel,
  DsMenuSeparator,
  DsRoot,
  useDsRoot,
} from "@/components/ds";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  dashboardNavGroups,
  dashboardRoleLabels,
  getDashboardNavItem,
  getListedDashboardItems,
  isDashboardItemActive,
  type DashboardNavItem,
} from "@/lib/dashboard-navigation";
import { usePublicSiteSettings } from "@/lib/public-home-query";
import { useTheme } from "@/lib/theme";

const SIDEBAR_STORAGE_KEY = "hospital-dashboard-sidebar-collapsed";
const SIDEBAR_CHANGE_EVENT = "hospital-dashboard-sidebar-change";

function subscribeToSidebarPreference(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(SIDEBAR_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(SIDEBAR_CHANGE_EVENT, onStoreChange);
  };
}

function getSidebarPreference() {
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function getServerSidebarPreference() {
  return false;
}

function getInitials(fullName?: string | null) {
  if (!fullName?.trim()) return "HB";
  return fullName
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function Avatar({ name, src }: { name?: string | null; src?: string | null }) {
  return (
    <span className="ds-avatar" aria-hidden="true">
      {src ? <img src={src} alt="" /> : getInitials(name)}
    </span>
  );
}

function Brand({ hospitalName, logo }: { hospitalName: string; logo?: string }) {
  return (
    <>
      <span className="ds-brand-mark">
        {logo ? <img src={logo} alt="" /> : <Hospital aria-hidden="true" />}
      </span>
      <span className="ds-brand-text">
        <small>Trung tâm điều hành</small>
        <strong title={hospitalName}>{hospitalName}</strong>
      </span>
    </>
  );
}

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: DashboardNavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const active = isDashboardItemActive(item, pathname);

  return (
    <Link
      href={item.href}
      prefetch
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={item.label}
      title={item.label}
      className="ds-nav__link"
    >
      <Icon aria-hidden="true" />
      <span>{item.label}</span>
    </Link>
  );
}

function Navigation({
  pathname,
  items,
  collapsed,
  onNavigate,
}: {
  pathname: string;
  items: DashboardNavItem[];
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const activeGroup = items.find((item) => isDashboardItemActive(item, pathname))?.group;
  const [closedGroups, setClosedGroups] = useState<Set<string>>(() => new Set());

  const toggleGroup = (key: string) =>
    setClosedGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const groups = dashboardNavGroups.filter((group) => items.some((item) => item.group === group.key));

  return (
    <nav className="ds-nav" aria-label="Điều hướng khu quản trị">
      {groups.map((group, index) => {
        const groupItems = items.filter((item) => item.group === group.key);
        const closed = !collapsed && closedGroups.has(group.key) && activeGroup !== group.key;

        return (
          <div key={group.key} className="ds-nav__group">
            {collapsed ? (
              index > 0 ? <div className="ds-nav__rule" aria-hidden="true" /> : null
            ) : (
              <button
                type="button"
                className="ds-nav__label"
                aria-expanded={!closed}
                onClick={() => toggleGroup(group.key)}
              >
                {group.label}
                {closed ? <ChevronRight aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
              </button>
            )}
            {closed
              ? null
              : groupItems.map((item) => (
                  <NavLink key={item.key} item={item} pathname={pathname} onNavigate={onNavigate} />
                ))}
          </div>
        );
      })}
    </nav>
  );
}

// Lệnh tìm nhanh (Ctrl K): lọc theo tên và mô tả, mũi tên lên/xuống di chuyển giữa các kết quả.
function CommandPalette({
  open,
  onOpenChange,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: DashboardNavItem[];
}) {
  const container = useDsRoot();
  const [term, setTerm] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const normalized = term.trim().toLocaleLowerCase("vi");
    if (!normalized) return items;
    return items.filter((item) => `${item.label} ${item.description}`.toLocaleLowerCase("vi").includes(normalized));
  }, [items, term]);

  const moveFocus = (current: HTMLElement | null, delta: 1 | -1) => {
    const links = Array.from(listRef.current?.querySelectorAll<HTMLElement>("a") ?? []);
    if (links.length === 0) return;
    const index = current ? links.indexOf(current) : -1;
    const next = links[Math.min(Math.max(index + delta, 0), links.length - 1)];
    next?.focus();
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setTerm("");
        onOpenChange(next);
      }}
    >
      <Dialog.Portal container={container ?? undefined}>
        <Dialog.Overlay className="ds-palette-overlay" />
        <Dialog.Content className="ds ds-palette">
          <Dialog.Title className="sr-only">Tìm nhanh chức năng quản trị</Dialog.Title>
          <Dialog.Description className="sr-only">
            Nhập tên chức năng, dùng mũi tên để chọn và Enter để mở.
          </Dialog.Description>
          <div className="ds-palette__input">
            <Search aria-hidden="true" />
            <input
              autoFocus
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  moveFocus(null, 1);
                }
              }}
              placeholder="Nhập tên chức năng hoặc công việc cần làm"
              aria-label="Tìm chức năng"
            />
            <span className="ds-kbd">Esc</span>
          </div>
          <div
            className="ds-palette__list"
            ref={listRef}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                moveFocus(event.target instanceof HTMLElement ? event.target.closest("a") : null, event.key === "ArrowDown" ? 1 : -1);
              }
            }}
          >
            {results.length ? (
              results.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className="ds-palette__item"
                    onClick={() => {
                      setTerm("");
                      onOpenChange(false);
                    }}
                  >
                    <Icon aria-hidden="true" />
                    <span>
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                  </Link>
                );
              })
            ) : (
              <p className="ds-palette__empty">Không tìm thấy chức năng. Thử từ khóa như “lịch”, “bác sĩ” hoặc “thông báo”.</p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ShellFrame({ children, collapsed }: { children: React.ReactNode; collapsed: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const unreadQuery = useQuery({
    queryKey: ["dashboard", "inbox", "unread-count"],
    queryFn: () => apiRequest<{ unreadCount: number }>("/dashboard/inbox/unread-count"),
    enabled: Boolean(user),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
  const unreadCount = unreadQuery.data?.unreadCount ?? 0;
  const { theme, toggleTheme } = useTheme();
  const siteSettingsQuery = usePublicSiteSettings();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const items = useMemo(() => (user ? getListedDashboardItems(user) : []), [user]);
  const baseItem = getDashboardNavItem(pathname);
  const currentItem = (baseItem && items.find((item) => item.key === baseItem.key)) || baseItem;
  const siteSettings = siteSettingsQuery.data || null;
  const hospitalName = siteSettings?.hospitalName?.trim() || "Hệ thống đặt khám";
  const logo = siteSettings?.logo?.trim();
  const dark = theme === "dark";
  const currentLabel = currentItem?.label;

  // Tiêu đề tab theo mục đang mở (và theo tên của chính mục đó với từng vai trò), không dùng chung một tiêu đề cho mọi trang.
  useEffect(() => {
    if (currentLabel) document.title = `${currentLabel} | ${hospitalName}`;
  }, [currentLabel, hospitalName]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  // Nạp trước mọi trang trong sidebar lúc trình duyệt rảnh để bấm là chuyển ngay.
  useEffect(() => {
    if (items.length === 0) return;
    const run = () => items.forEach((item) => router.prefetch(item.href));
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(run, 500);
    return () => window.clearTimeout(id);
  }, [router, items]);

  const toggleSidebar = () => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!collapsed));
    } catch {
      // Không lưu được (chế độ riêng tư): vẫn đổi trạng thái trong phiên này.
    }
    window.dispatchEvent(new Event(SIDEBAR_CHANGE_EVENT));
  };

  return (
    <>
      <a className="ui-skip-link" href="#main-content">
        Bỏ qua điều hướng
      </a>

      <aside className="ds-side" aria-label="Thanh điều hướng">
        <div className="ds-side__brand">
          <Brand hospitalName={hospitalName} logo={logo} />
        </div>
        <Navigation pathname={pathname} items={items} collapsed={collapsed} />
        <div className="ds-side__foot">
          <DsButton
            variant="ghost"
            className="w-full"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
            title={collapsed ? "Mở rộng thanh điều hướng" : "Thu gọn thanh điều hướng"}
          >
            {collapsed ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
            {collapsed ? null : "Thu gọn"}
          </DsButton>
          <div className="ds-user">
            <Avatar name={user?.fullName} src={user?.avatar} />
            <span className="ds-user__text">
              <strong>{user?.fullName}</strong>
              <small>{user ? dashboardRoleLabels[user.role] : "Đang tải"}</small>
            </span>
          </div>
        </div>
      </aside>

      <div className="ds-main">
        <header className="ds-top">
          <DsButton
            icon
            variant="ghost"
            className="ds-only-mobile"
            onClick={() => setMobileOpen(true)}
            aria-label="Mở thanh điều hướng"
            aria-expanded={mobileOpen}
          >
            <Menu aria-hidden="true" />
          </DsButton>

          <div className="ds-top__title">
            <div className="ds-top__crumb">
              {pathname === "/dashboard" ? (
                "Quản trị"
              ) : (
                <>
                  <Link href="/dashboard">Quản trị</Link>
                  {currentItem ? ` / ${currentItem.label}` : null}
                </>
              )}
            </div>
            <h1>{currentItem?.label || "Quản trị hệ thống"}</h1>
          </div>

          <button type="button" className="ds-search-btn" onClick={() => setSearchOpen(true)} aria-label="Tìm chức năng">
            <Search aria-hidden="true" />
            <span>Tìm chức năng</span>
            <kbd className="ds-kbd">Ctrl K</kbd>
          </button>

          {user ? (
            <Link href="/dashboard/inbox" className="ds-btn ds-btn--ghost ds-btn--icon" aria-label={unreadCount ? `Thông báo của tôi, ${unreadCount} chưa đọc` : "Thông báo của tôi"} title="Thông báo của tôi" style={{ position: "relative" }}>
              <Bell aria-hidden="true" />
              {unreadCount ? (
                <span aria-hidden="true" style={{ position: "absolute", top: 2, right: 2, minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8, background: "var(--ds-bad, #c0392b)", color: "#fff", fontSize: 10, fontWeight: 700, lineHeight: "16px", textAlign: "center" }}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </Link>
          ) : null}

          <DsMenu
            trigger={
              <button type="button" className="ds-btn ds-btn--ghost" aria-label="Mở menu tài khoản" style={{ padding: "0 6px 0 4px" }}>
                <Avatar name={user?.fullName} src={user?.avatar} />
                <span className="ds-only-desktop" style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {user?.fullName}
                </span>
                <ChevronDown aria-hidden="true" />
              </button>
            }
          >
            <DsMenuLabel title={user?.fullName || ""} subtitle={user ? dashboardRoleLabels[user.role] : undefined} />
            <DsMenuSeparator />
            <DsMenuItem onSelect={toggleTheme}>
              {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
              {dark ? "Giao diện sáng" : "Giao diện tối"}
            </DsMenuItem>
            <DsMenuItem danger onSelect={() => void logout()}>
              <LogOut aria-hidden="true" />
              Đăng xuất
            </DsMenuItem>
          </DsMenu>
        </header>

        <main id="main-content" tabIndex={-1} className="ds-content">
          {children}
        </main>
      </div>

      <DsDrawer
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        side="left"
        flush
        title="Điều hướng quản trị"
        description="Chọn phân hệ quản trị cần làm việc."
      >
        <Navigation pathname={pathname} items={items} collapsed={false} onNavigate={() => setMobileOpen(false)} />
      </DsDrawer>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} items={items} />
    </>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const collapsed = useSyncExternalStore(subscribeToSidebarPreference, getSidebarPreference, getServerSidebarPreference);

  return (
    <DsRoot className="ds-shell" data-collapsed={collapsed}>
      <ShellFrame collapsed={collapsed}>{children}</ShellFrame>
    </DsRoot>
  );
}
