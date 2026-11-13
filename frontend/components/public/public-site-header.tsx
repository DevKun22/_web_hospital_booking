"use client";

import {
  CalendarCheck,
  Clock3,
  Menu,
  MessageCircleQuestion,
  Phone,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { PublicGlobalSearch } from "@/components/public/public-global-search";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { PatientUser } from "@/lib/patient-portal-types";
import {
  loadOptionalPatientSession,
  patientSessionQueryKey,
} from "@/lib/patient-session-client";
import { openPublicChatbot } from "@/lib/public-ui-events";
import type { SiteSettingsValue } from "@/lib/types";

import Image from "next/image";
import { BrandLogo } from "@/components/branding/brand-logo";
import { BRAND_NAME } from "@/lib/brand";
const navItems = [
  { href: "/chuyen-khoa", label: "Chuyên khoa", aliases: [] },
  { href: "/bac-si", label: "Bác sĩ", aliases: [] },
  { href: "/goi-kham", label: "Gói khám", aliases: [] },
  { href: "/ho-tro", label: "Hỗ trợ", aliases: ["/hoi-dap", "/huong-dan"] },
] as const;

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
        ? "flex min-h-12 items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]"
        : "inline-flex min-h-11 max-w-44 items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm font-semibold text-[var(--public-text-soft)] transition hover:bg-[var(--public-surface-muted)] hover:text-[var(--public-primary)]"
      }
    >
      {user ? (
        user.avatar ? (
          <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-[var(--public-border)] bg-[var(--public-primary-soft)]">
            <Image src={user.avatar} alt="" fill sizes="32px" quality={70} className="object-cover" />
          </span>
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--public-primary-soft)] text-xs font-bold text-[var(--public-primary-dark)]" aria-hidden="true">
            {getPatientInitials(user.fullName)}
          </span>
        )
      ) : (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--public-surface-muted)]" aria-hidden="true">
          <UserRound className="h-4 w-4" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate">{user ? `Chào, ${getPatientDisplayName(user.fullName)}` : "Đăng nhập"}</span>
        {mobile ? (
          <span className="block truncate text-xs font-normal text-[var(--public-muted)]">
            {user ? "Xem lịch và hồ sơ của bạn" : "Quản lý lịch và hồ sơ người khám"}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

export function PublicSiteHeader({
  settings,
  accountSlot,
}: {
  settings: SiteSettingsValue | null;
  accountSlot?: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const patientSessionQuery = useQuery({
    queryKey: patientSessionQueryKey,
    queryFn: loadOptionalPatientSession,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const hotline =
    settings?.hotline?.trim() ||
    settings?.emergencyHotline?.trim() ||
    "1900 0000";

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

  const openConsultation = () => {
    setMobileOpen(false);
    window.setTimeout(openPublicChatbot, mobileOpen ? 120 : 0);
  };

  return (
    <>
      <div className="hidden border-b border-[var(--public-border)] bg-[var(--public-surface-muted)] text-[var(--public-text-soft)] xl:block">
        <div className="ui-container flex min-h-9 items-center justify-between gap-6 text-xs">
          <div className="flex min-w-0 items-center gap-5">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5 text-[var(--public-primary)]" aria-hidden="true" />
              {settings?.workingHours || "Đặt lịch trước để được phục vụ tốt hơn"}
            </span>
            {settings?.address ? (
              <span className="max-w-[32rem] truncate">{settings.address}</span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <button
              type="button"
              onClick={openConsultation}
              className="inline-flex items-center gap-1.5 font-semibold transition hover:text-[var(--public-primary)]"
            >
              <MessageCircleQuestion className="h-3.5 w-3.5" aria-hidden="true" />
              Tư vấn trực tuyến
            </button>
            <a
              href={`tel:${hotline}`}
              className="inline-flex items-center gap-1.5 font-semibold text-[var(--public-danger)] transition hover:underline"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              {hotline}
            </a>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-50 border-b border-[var(--public-border)] bg-[var(--public-surface)] shadow-[0_1px_0_rgba(23,43,77,0.05)] backdrop-blur-xl">
        <div className="ui-container grid min-h-[4.75rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2 md:grid-cols-[minmax(220px,0.72fr)_minmax(280px,1.25fr)_auto] xl:grid-cols-[minmax(220px,0.72fr)_minmax(320px,1.25fr)_auto] xl:gap-4">
          <Link href="/" onClick={() => setMobileOpen(false)} className="group flex min-w-0 items-center" aria-label={`${BRAND_NAME} - Trang chủ`}>
            <BrandLogo variant="horizontal" size="md" className="transition group-hover:-translate-y-0.5" />
          </Link>

          <div className="hidden min-w-0 md:block">
            <PublicGlobalSearch compact />
          </div>

          <div className="hidden items-center gap-2 xl:flex">
            <ThemeToggle />
            <Link
              href="/tai-khoan/dang-nhap?next=/tai-khoan/lich-hen"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[var(--public-text-soft)] transition hover:bg-[var(--public-surface-muted)] hover:text-[var(--public-primary)]"
            >
              <CalendarCheck className="h-4 w-4" aria-hidden="true" />
              Tra cứu lịch
            </Link>
            {accountSlot ?? (
              <PatientIdentity user={patientSessionQuery.data} />
            )}
            <Link
              href="/dat-lich"
              className="public-button-primary inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-bold"
            >
              Đặt lịch khám
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((current) => !current)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--public-border)] text-[var(--public-text-soft)] transition hover:bg-[var(--public-surface-muted)] xl:hidden"
            aria-label={mobileOpen ? "Đóng menu" : "Mở menu"}
            aria-expanded={mobileOpen}
            aria-controls="public-site-mobile-navigation"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <div className="ui-container pb-3 md:hidden">
          <PublicGlobalSearch compact />
        </div>

        <div className="hidden border-t border-[var(--public-border)] bg-[var(--public-surface)] xl:block">
          <div className="ui-container flex min-h-11 items-center justify-between gap-4">
            <nav aria-label="Điều hướng chính" className="flex min-w-0 items-center gap-1 overflow-x-auto">
              <Link
                href="/"
                aria-current={pathname === "/" ? "page" : undefined}
                className={`shrink-0 border-b-2 px-3 py-3 text-sm font-semibold transition-colors ${
                  pathname === "/"
                    ? "border-[var(--public-primary)] text-[var(--public-primary)]"
                    : "border-transparent text-[var(--public-text-soft)] hover:text-[var(--public-primary)]"
                }`}
              >
                Trang chủ
              </Link>
              {navItems.map((item) => {
                const active = isActivePath(pathname, item.href) || item.aliases.some((href) => isActivePath(pathname, href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`shrink-0 border-b-2 px-3 py-3 text-sm font-semibold transition-colors ${
                      active
                        ? "border-[var(--public-primary)] text-[var(--public-primary)]"
                        : "border-transparent text-[var(--public-text-soft)] hover:text-[var(--public-primary)]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <button
              type="button"
              onClick={openConsultation}
              className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[var(--public-primary-soft)] px-3 py-2 text-sm font-bold text-[var(--public-primary-dark)] transition hover:bg-[var(--public-primary)] hover:text-white"
            >
              <MessageCircleQuestion className="h-4 w-4" aria-hidden="true" />
              Tư vấn trực tuyến
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <div
            id="public-site-mobile-navigation"
            className="fixed inset-x-0 top-[8.25rem] z-50 min-h-[calc(100dvh-8.25rem)] max-h-[calc(100dvh-8.25rem)] overflow-y-auto border-t border-[var(--public-border)] bg-[var(--public-surface)] px-4 py-5 shadow-2xl md:top-[4.75rem] md:min-h-[calc(100dvh-4.75rem)] md:max-h-[calc(100dvh-4.75rem)] xl:hidden"
          >
            <nav aria-label="Điều hướng trên điện thoại" className="mx-auto max-w-lg space-y-1">
              {navItems.map((item) => {
                const active = isActivePath(pathname, item.href) || item.aliases.some((href) => isActivePath(pathname, href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`block min-h-12 rounded-xl px-4 py-3 text-sm font-semibold ${
                      active
                        ? "bg-[var(--public-primary-soft)] text-[var(--public-primary-dark)]"
                        : "text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <Link href="/tim-kiem" onClick={() => setMobileOpen(false)} className="block min-h-12 rounded-xl px-4 py-3 text-sm font-semibold text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]">
                Tìm kiếm dịch vụ
              </Link>
              <Link href="/tai-khoan/dang-nhap?next=/tai-khoan/lich-hen" onClick={() => setMobileOpen(false)} className="block min-h-12 rounded-xl px-4 py-3 text-sm font-semibold text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]">
                Tra cứu lịch hẹn
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
                className="block min-h-12 w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]"
              >
                Tư vấn trực tuyến
              </button>
              <div className="grid grid-cols-2 gap-2 pt-4">
                <a href={`tel:${hotline}`} className="public-button-secondary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold">
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  Gọi hỗ trợ
                </a>
                <Link href="/dat-lich" onClick={() => setMobileOpen(false)} className="public-button-primary inline-flex min-h-12 items-center justify-center rounded-xl px-3 text-sm font-bold">
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
