"use client";

/* eslint-disable @next/next/no-img-element */

import {
  Bell,
  ChevronDown,
  ChevronRight,
  Hospital,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth";
import {
  dashboardNavGroups,
  dashboardRoleLabels,
  getDashboardNavItem,
  getVisibleDashboardItems,
  isDashboardItemActive,
  type DashboardNavItem,
} from "@/lib/dashboard-navigation";
import { usePublicSiteSettings } from "@/lib/public-home-query";

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
  return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
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

function DashboardBrand({
  hospitalName,
  logo,
  compact = false,
}: {
  hospitalName: string;
  logo?: string;
  compact?: boolean;
}) {
  return (
    <>
      <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10">
        {logo ? (
          <img
            src={logo}
            alt={hospitalName}
            className="size-full object-contain p-1.5"
          />
        ) : (
          <Hospital className="size-5" aria-hidden="true" />
        )}
      </div>
      {!compact ? (
        <div className="min-w-0 flex-1">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Trung tâm điều hành
          </p>
          <p className="truncate text-sm font-semibold text-foreground" title={hospitalName}>
            {hospitalName}
          </p>
        </div>
      ) : null}
    </>
  );
}

function DashboardNavLink({
  item,
  pathname,
  collapsed,
  onNavigate,
}: {
  item: DashboardNavItem;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const active = isDashboardItemActive(item, pathname);
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`group relative flex min-h-10 items-center rounded-lg text-sm font-medium transition-colors ${
        collapsed ? "justify-center px-2" : "gap-3 px-3"
      } ${
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className={collapsed ? "sr-only" : "min-w-0 flex-1 truncate"}>
        {item.label}
      </span>
      {active ? (
        <span
          className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-primary"
          aria-hidden="true"
        />
      ) : null}
    </Link>
  );

  if (!collapsed) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

function DashboardNavigation({
  pathname,
  collapsed,
  items,
  onNavigate,
}: {
  pathname: string;
  collapsed: boolean;
  items: DashboardNavItem[];
  onNavigate?: () => void;
}) {
  const activeGroup = items.find((item) => isDashboardItemActive(item, pathname))?.group;
  const [closedGroups, setClosedGroups] = useState<Set<string>>(() => new Set());

  const toggleGroup = (groupKey: string) => {
    setClosedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  return (
    <nav
      className={`min-h-0 flex-1 overflow-y-auto overscroll-contain py-4 [scrollbar-gutter:stable] ${
        collapsed ? "px-2" : "px-3"
      }`}
      aria-label="Điều hướng khu quản trị"
    >
      {dashboardNavGroups.map((group) => {
        const groupItems = items.filter((item) => item.group === group.key);
        if (groupItems.length === 0) return null;
        const isClosed = closedGroups.has(group.key) && activeGroup !== group.key;

        return (
          <section key={group.key} className="mb-4 last:mb-0">
            {!collapsed ? (
              <button
                type="button"
                onClick={() => toggleGroup(group.key)}
                className="mb-1 flex min-h-8 w-full items-center justify-between rounded-md px-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80 hover:bg-muted hover:text-foreground"
                aria-expanded={!isClosed}
              >
                {group.label}
                {isClosed ? <ChevronRight className="size-3.5" aria-hidden="true" /> : <ChevronDown className="size-3.5" aria-hidden="true" />}
              </button>
            ) : null}
            <div className={`grid transition-[grid-template-rows,opacity] duration-200 ${isClosed && !collapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"}`}>
              <div className="min-h-0 space-y-1 overflow-hidden">
              {groupItems.map((item) => (
                <DashboardNavLink
                  key={item.key}
                  item={item}
                  pathname={pathname}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              ))}
              </div>
            </div>
          </section>
        );
      })}
    </nav>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const siteSettingsQuery = usePublicSiteSettings();
  const sidebarCollapsed = useSyncExternalStore(
    subscribeToSidebarPreference,
    getSidebarPreference,
    getServerSidebarPreference,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const currentItem = getDashboardNavItem(pathname);
  const visibleItems = useMemo(
    () => (user ? getVisibleDashboardItems(user.role) : []),
    [user],
  );
  const siteSettings = siteSettingsQuery.data || null;
  const hospitalName = siteSettings?.hospitalName?.trim() || "Hệ thống đặt khám";
  const logo = siteSettings?.logo?.trim();
  const userInitials = getInitials(user?.fullName);
  const searchResults = useMemo(() => {
    const normalized = searchTerm.trim().toLocaleLowerCase("vi");
    if (!normalized) return visibleItems;
    return visibleItems.filter((item) =>
      `${item.label} ${item.description}`.toLocaleLowerCase("vi").includes(normalized),
    );
  }, [searchTerm, visibleItems]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((current) => !current);
      }
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const toggleSidebar = () => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(!sidebarCollapsed));
    window.dispatchEvent(new Event(SIDEBAR_CHANGE_EVENT));
  };

  return (
    <div className="dashboard-shell min-h-screen bg-background text-foreground">
      <a className="ui-skip-link" href="#main-content">
        Bỏ qua điều hướng
      </a>
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden h-dvh flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out lg:flex ${
          sidebarCollapsed ? "w-20" : "w-72"
        }`}
      >
        <div
          className={`flex h-18 items-center border-b border-sidebar-border ${
            sidebarCollapsed ? "justify-center px-3" : "gap-3 px-4"
          }`}
        >
          <DashboardBrand hospitalName={hospitalName} logo={logo} compact={sidebarCollapsed} />
          {!sidebarCollapsed ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              aria-label="Thu gọn thanh điều hướng"
            >
              <PanelLeftClose aria-hidden="true" />
            </Button>
          ) : null}
        </div>

        <DashboardNavigation
          pathname={pathname}
          collapsed={sidebarCollapsed}
          items={visibleItems}
        />

        <div className={`border-t border-sidebar-border p-3 ${sidebarCollapsed ? "flex justify-center" : ""}`}>
          {sidebarCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar aria-label={user?.fullName || "Tài khoản"}>
                  <AvatarImage src={user?.avatar || undefined} alt="" />
                  <AvatarFallback>{userInitials}</AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {user?.fullName}
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-3 rounded-xl bg-muted/70 p-2.5">
              <Avatar>
                <AvatarImage src={user?.avatar || undefined} alt="" />
                <AvatarFallback>{userInitials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{user?.fullName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {user ? dashboardRoleLabels[user.role] : "Đang tải"}
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[min(22rem,90vw)] gap-0 p-0" showCloseButton={false}>
          <SheetHeader className="flex-row items-center gap-3 border-b border-border px-4 py-3 text-left">
            <DashboardBrand hospitalName={hospitalName} logo={logo} />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(false)}
              aria-label="Đóng thanh điều hướng"
            >
              <PanelLeftClose aria-hidden="true" />
            </Button>
            <SheetTitle className="sr-only">Điều hướng quản trị</SheetTitle>
            <SheetDescription className="sr-only">
              Chọn phân hệ quản trị cần làm việc.
            </SheetDescription>
          </SheetHeader>
          <DashboardNavigation
            pathname={pathname}
            collapsed={false}
            items={visibleItems}
            onNavigate={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div
        className={`transition-[padding] duration-200 ease-out ${
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-72"
        }`}
      >
        <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/78">
          <div className="flex min-h-18 items-center gap-3 px-4 sm:px-6">
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden"
              aria-label="Mở thanh điều hướng"
              aria-expanded={mobileOpen}
            >
              <Menu aria-hidden="true" />
            </Button>

            {sidebarCollapsed ? (
              <Button
                type="button"
                variant="outline"
                size="icon-lg"
                onClick={toggleSidebar}
                className="hidden lg:inline-flex"
                aria-label="Mở rộng thanh điều hướng"
              >
                <PanelLeftOpen aria-hidden="true" />
              </Button>
            ) : null}

            <div className="min-w-0 flex-1">
              <Breadcrumb className="hidden sm:block">
                <BreadcrumbList className="text-xs">
                  <BreadcrumbItem>
                    {pathname === "/dashboard" ? (
                      <BreadcrumbPage>Quản trị</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href="/dashboard">Quản trị</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {pathname !== "/dashboard" && currentItem ? (
                    <>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbPage>{currentItem.label}</BreadcrumbPage>
                      </BreadcrumbItem>
                    </>
                  ) : null}
                </BreadcrumbList>
              </Breadcrumb>
              <div className="mt-0.5 flex min-w-0 items-baseline gap-2">
                <h1 className="truncate text-base font-semibold sm:text-lg">
                  {currentItem?.label || "Quản trị hệ thống"}
                </h1>
                <p className="hidden truncate text-xs text-muted-foreground xl:block">
                  {currentItem?.description}
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="hidden h-10 w-full max-w-64 justify-start gap-2 px-3 text-muted-foreground md:inline-flex"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="size-4" aria-hidden="true" />
              <span className="truncate">Tìm chức năng</span>
              <kbd className="ml-auto rounded border border-border bg-muted px-1.5 py-0.5 text-[0.65rem] font-medium">Ctrl K</kbd>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className="md:hidden"
              onClick={() => setSearchOpen(true)}
              aria-label="Tìm chức năng"
            >
              <Search aria-hidden="true" />
            </Button>

            {user && ["ADMIN", "STAFF"].includes(user.role) ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-lg" asChild>
                    <Link href="/dashboard/notifications" aria-label="Mở trung tâm thông báo">
                      <Bell aria-hidden="true" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Trung tâm thông báo</TooltipContent>
              </Tooltip>
            ) : null}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-11 gap-2 px-2" aria-label="Mở menu tài khoản">
                  <Avatar>
                    <AvatarImage src={user?.avatar || undefined} alt="" />
                    <AvatarFallback>{userInitials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-40 truncate text-sm font-semibold md:block">
                    {user?.fullName}
                  </span>
                  <ChevronDown className="hidden size-4 text-muted-foreground md:block" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-2">
                <DropdownMenuLabel className="px-2 py-2">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {user?.fullName}
                  </span>
                  <span className="mt-0.5 block truncate font-normal text-muted-foreground">
                    {user ? dashboardRoleLabels[user.role] : "Đang tải"}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="min-h-9 px-2">
                  <UserRound aria-hidden="true" />
                  Hồ sơ tài khoản
                  <span className="ml-auto text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                    Sắp có
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  className="min-h-9 px-2"
                  onSelect={() => void logout()}
                >
                  <LogOut aria-hidden="true" />
                  Đăng xuất
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1680px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          {children}
        </main>
      </div>

      {searchOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/45 p-4 pt-[12vh] backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="dashboard-search-title">
          <button type="button" className="absolute inset-0" onClick={() => setSearchOpen(false)} aria-label="Đóng tìm kiếm" />
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl">
            <h2 id="dashboard-search-title" className="sr-only">Tìm nhanh chức năng quản trị</h2>
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                autoFocus
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Nhập tên chức năng hoặc công việc cần làm..."
                className="h-14 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <kbd className="rounded border border-border bg-muted px-2 py-1 text-xs text-muted-foreground">Esc</kbd>
            </div>
            <div className="max-h-[min(28rem,60vh)] overflow-y-auto p-2">
              {searchResults.length ? searchResults.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => { setSearchOpen(false); setSearchTerm(""); }}
                    className="flex items-start gap-3 rounded-xl px-3 py-3 hover:bg-muted focus-visible:bg-muted"
                  >
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="size-4" aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{item.description}</span>
                    </span>
                    <ChevronRight className="mt-2 size-4 text-muted-foreground" aria-hidden="true" />
                  </Link>
                );
              }) : (
                <div className="px-4 py-10 text-center">
                  <p className="font-semibold">Không tìm thấy chức năng</p>
                  <p className="mt-1 text-sm text-muted-foreground">Hãy thử từ khóa khác như “lịch”, “bác sĩ” hoặc “thông báo”.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
