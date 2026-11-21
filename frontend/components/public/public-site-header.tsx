"use client";

import {
  CalendarCheck,
  Clock3,
  MapPin,
  Menu,
  Moon,
  Phone,
  Search,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { PublicGlobalSearch } from "@/components/public/public-global-search";
import { PublicSubNav } from "@/components/public/public-sub-nav";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { PatientUser } from "@/lib/patient-portal-types";
import {
  loadOptionalPatientSession,
  patientLookupLink,
  patientSessionQueryKey,
} from "@/lib/patient-session-client";
import { openPublicChatbot } from "@/lib/public-ui-events";
import { useTheme } from "@/lib/theme";
import type { SiteSettingsValue } from "@/lib/types";

import Image from "next/image";
import { BrandLogo } from "@/components/branding/brand-logo";
import { BRAND_NAME } from "@/lib/brand";


const mobileNavItems = [
  { href: "/chuyen-khoa", label: "Chuyên khoa", aliases: [] },
  { href: "/bac-si", label: "Bác sĩ", aliases: [] },
  { href: "/goi-kham", label: "Gói khám", aliases: [] },
  { href: "/kien-thuc", label: "Kiến thức", aliases: [] },
  { href: "/ho-tro", label: "Hỗ trợ", aliases: ["/hoi-dap", "/huong-dan"] },
] as const;

const primaryNavItems = [
  { href: "/", label: "Trang chủ", aliases: [] as string[] },
  { href: "/ho-tro", label: "Hỗ trợ", aliases: ["/hoi-dap", "/huong-dan"] },
];

const isActivePath = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

function getPatientInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "NK";
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase("vi-VN");
  return `${parts[0][0]}${parts.at(-1)?.[0] || ""}`.toLocaleUpperCase("vi-VN");
}

function getPatientDisplayName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts.at(-1) || "Người khám";
}

function PatientIdentity({
  user,
  mobile = false,
  onNavigate,
}: {
  user: PatientUser | null | undefined;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const href = user ? "/tai-khoan" : "/tai-khoan/dang-nhap";
  const label = user ? `Mở cổng người khám của ${user.fullName}` : "Đăng nhập cổng người khám";

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-label={label}
      title={user?.fullName || "Đăng nhập"}
      className={mobile
        ? "flex min-h-12 items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]"
        : "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-[var(--public-text-soft)] transition hover:bg-[var(--public-surface-muted)] hover:text-[var(--public-primary)]"
      }
    >
      {user ? (
        user.avatar ? (
          <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-[var(--public-border)] bg-[var(--public-primary-soft)]">
            <Image src={user.avatar} alt="" fill sizes="32px" quality={70} className="object-cover" />
          </span>
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--public-primary-soft)] text-xs font-semibold text-[var(--public-primary-dark)]" aria-hidden="true">
            {getPatientInitials(user.fullName)}
          </span>
        )
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--public-surface-muted)]" aria-hidden="true">
          <UserRound className="h-4 w-4" />
        </span>
      )}
      {mobile ? (
        <span className="min-w-0">
          <span className="block truncate">{user ? `Chào, ${getPatientDisplayName(user.fullName)}` : "Đăng nhập"}</span>
          <span className="block truncate text-xs font-normal text-[var(--public-muted)]">
            {user ? "Xem lịch và hồ sơ của bạn" : "Quản lý lịch và hồ sơ người khám"}
          </span>
        </span>
      ) : null}
    </Link>
  );
}

/** Nút đổi giao diện sáng/tối cho thanh phụ nền xanh (nút dùng chung có nền sáng nên không hợp ở đây). */
function TopBarThemeButton() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  const label = dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      aria-pressed={dark}
      title={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded text-white/85 transition hover:bg-white/15 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
    >
      {dark ? <Sun className="h-3.5 w-3.5" aria-hidden="true" /> : <Moon className="h-3.5 w-3.5" aria-hidden="true" />}
    </button>
  );
}

// Header công khai: thanh phụ (liên hệ, giờ làm việc, tiện ích) và thanh chính (logo, điều hướng có menu con, tìm kiếm, hai nút hành động).
// Dưới 1280px chỉ còn thanh chính gọn với nút menu; menu điện thoại liệt kê đủ mục và lối vào.
export function PublicSiteHeader({
  settings,
  accountSlot,
}: {
  settings: SiteSettingsValue | null;
  accountSlot?: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const patientSessionQuery = useQuery({
    queryKey: patientSessionQueryKey,
    queryFn: loadOptionalPatientSession,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const lookup = patientLookupLink(patientSessionQuery.data);
  // Chỉ hiện số điện thoại khi cơ sở đã cấu hình; không dùng số giả để lấp chỗ trống.
  const hotline = settings?.hotline?.trim() || settings?.emergencyHotline?.trim() || "";
  const workingHours = settings?.workingHours?.trim() || "";
  const address = settings?.address?.trim() || "";

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.classList.add("public-menu-open");
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.classList.remove("public-menu-open");
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen]);

  // Ô tìm kiếm mở ra thì đưa con trỏ vào ô nhập; Esc đóng lại.
  useEffect(() => {
    if (!searchOpen) return;
    searchRef.current?.querySelector("input")?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [searchOpen]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  const openConsultation = () => {
    setMobileOpen(false);
    window.setTimeout(() => openPublicChatbot(), mobileOpen ? 120 : 0);
  };

  return (
    <>
      <div className="hidden bg-[var(--dk-blue)] text-white xl:block">
        <div className="ui-container flex min-h-9 items-center justify-between gap-6 text-xs">
          <div className="flex min-w-0 items-center gap-5">
            {hotline ? (
              <a href={`tel:${hotline}`} className="inline-flex shrink-0 items-center gap-1.5 font-medium tabular-nums hover:underline">
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                {hotline}
              </a>
            ) : null}
            <span className="inline-flex shrink-0 items-center gap-1.5 text-white/90">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
              {workingHours || "Đặt lịch trước để được phục vụ tốt hơn"}
            </span>
            {address ? (
              <span className="inline-flex min-w-0 items-center gap-1.5 text-white/90">
                <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="max-w-[28rem] truncate">{address}</span>
              </span>
            ) : null}
          </div>
          <nav aria-label="Liên kết tiện ích" className="flex shrink-0 items-center gap-1 text-white/90">
            <Link href="/huong-dan/dat-lich" className="rounded px-2 py-1 hover:bg-white/15 hover:text-white">Hướng dẫn đặt lịch</Link>
            <Link href="/hoi-dap" className="rounded px-2 py-1 hover:bg-white/15 hover:text-white">Hỏi đáp</Link>
            <Link href="/ho-tro" className="rounded px-2 py-1 hover:bg-white/15 hover:text-white">Liên hệ</Link>
            <span aria-hidden="true" className="mx-1 h-4 w-px bg-white/30" />
            <TopBarThemeButton />
          </nav>
        </div>
      </div>

      <header className="sticky top-0 z-50 border-b border-[var(--public-border)] bg-[var(--public-surface)] shadow-[0_1px_0_rgba(23,43,77,0.05)] backdrop-blur-xl">
        <div className="ui-container flex min-h-[4.25rem] items-center gap-3 py-2 xl:gap-6">
          <Link href="/" onClick={() => setMobileOpen(false)} className="group flex shrink-0 items-center" aria-label={`${BRAND_NAME} - Trang chủ`}>
            <BrandLogo variant="horizontal" size="md" className="transition group-hover:-translate-y-0.5" />
          </Link>

          <nav aria-label="Điều hướng chính" className="hidden min-w-0 flex-1 items-center gap-1 xl:flex">
            {primaryNavItems.map((item) => {
              const active = item.href === "/" ? pathname === "/" : isActivePath(pathname, item.href) || item.aliases.some((href) => isActivePath(pathname, href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${active ? "text-[var(--public-primary)]" : "text-[var(--public-text-soft)] hover:text-[var(--public-primary)]"}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto hidden items-center gap-1.5 xl:flex">
            <button
              type="button"
              onClick={() => setSearchOpen((current) => !current)}
              aria-label={searchOpen ? "Đóng ô tìm kiếm" : "Tìm bác sĩ, chuyên khoa, gói khám"}
              aria-expanded={searchOpen}
              aria-controls="public-header-search"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[var(--public-text-soft)] transition hover:bg-[var(--public-surface-muted)] hover:text-[var(--public-primary)]"
            >
              {searchOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Search className="h-5 w-5" aria-hidden="true" />}
            </button>
            {accountSlot ?? <PatientIdentity user={patientSessionQuery.data} />}
            <Link
              href={lookup.href}
              className="public-button-secondary inline-flex min-h-11 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
            >
              <CalendarCheck className="h-4 w-4" aria-hidden="true" />
              {lookup.label}
            </Link>
            <Link
              href="/dat-lich"
              className="public-button-primary inline-flex min-h-11 items-center justify-center rounded-lg px-5 py-2 text-sm font-semibold"
            >
              Đặt lịch khám
            </Link>
          </div>

          <div className="ml-auto flex items-center gap-1.5 xl:hidden">
            <button
              type="button"
              onClick={() => setSearchOpen((current) => !current)}
              aria-label={searchOpen ? "Đóng ô tìm kiếm" : "Tìm bác sĩ, chuyên khoa, gói khám"}
              aria-expanded={searchOpen}
              aria-controls="public-header-search"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[var(--public-text-soft)] transition hover:bg-[var(--public-surface-muted)]"
            >
              {searchOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Search className="h-5 w-5" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen((current) => !current)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--public-border)] text-[var(--public-text-soft)] transition hover:bg-[var(--public-surface-muted)]"
              aria-label={mobileOpen ? "Đóng menu" : "Mở menu"}
              aria-expanded={mobileOpen}
              aria-controls="public-site-mobile-navigation"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <PublicSubNav pathname={pathname} />

        {searchOpen ? (
          <div id="public-header-search" ref={searchRef} className="border-t border-[var(--public-border)] bg-[var(--public-surface-muted)]">
            <div className="ui-container py-3">
              <div className="mx-auto max-w-2xl">
                <PublicGlobalSearch compact />
              </div>
            </div>
          </div>
        ) : null}

        {mobileOpen ? (
          <div
            id="public-site-mobile-navigation"
            className="fixed inset-x-0 top-[4.25rem] z-50 max-h-[calc(100dvh-4.25rem)] min-h-[calc(100dvh-4.25rem)] overflow-y-auto border-t border-[var(--public-border)] bg-[var(--public-surface)] px-4 py-5 shadow-2xl xl:hidden"
          >
            <nav aria-label="Điều hướng trên điện thoại" className="mx-auto max-w-lg space-y-1">
              {mobileNavItems.map((item) => {
                const active = isActivePath(pathname, item.href) || item.aliases.some((href) => isActivePath(pathname, href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`block min-h-12 rounded-xl px-4 py-3 text-sm font-medium ${
                      active
                        ? "bg-[var(--public-primary-soft)] text-[var(--public-primary-dark)]"
                        : "text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <Link href="/tim-kiem" onClick={() => setMobileOpen(false)} className="block min-h-12 rounded-xl px-4 py-3 text-sm font-medium text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]">
                Tìm kiếm dịch vụ
              </Link>
              <Link href={lookup.href} onClick={() => setMobileOpen(false)} className="block min-h-12 rounded-xl px-4 py-3 text-sm font-medium text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]">
                {lookup.label}
              </Link>
              <PatientIdentity
                user={patientSessionQuery.data}
                mobile
                onNavigate={() => setMobileOpen(false)}
              />
              <ThemeToggle showLabel className="w-full justify-start px-4" />
              <button
                type="button"
                onClick={openConsultation}
                className="block min-h-12 w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]"
              >
                Tư vấn trực tuyến
              </button>
              <div className={`grid gap-2 pt-4 ${hotline ? "grid-cols-2" : "grid-cols-1"}`}>
                {hotline ? (
                  <a href={`tel:${hotline}`} className="public-button-secondary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold">
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    Gọi hỗ trợ
                  </a>
                ) : null}
                <Link href="/dat-lich" onClick={() => setMobileOpen(false)} className="public-button-primary inline-flex min-h-12 items-center justify-center rounded-xl px-3 text-sm font-semibold">
                  Đặt lịch
                </Link>
              </div>
            </nav>
          </div>
        ) : null}
      </header>
    </>
  );
}
