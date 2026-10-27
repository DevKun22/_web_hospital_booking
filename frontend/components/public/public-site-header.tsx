"use client";

import {
  CalendarCheck,
  Clock3,
  HeartPulse,
  Menu,
  MessageCircleQuestion,
  Phone,
  Search,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { openPublicConsultation } from "@/lib/public-ui-events";
import type { SiteSettingsValue } from "@/lib/types";

const navItems = [
  { href: "/departments", label: "Chuyên khoa" },
  { href: "/bac-si", label: "Bác sĩ" },
  { href: "/packages", label: "Gói khám" },
  { href: "/guide/booking", label: "Hướng dẫn" },
  { href: "/faqs", label: "Hỏi đáp" },
] as const;

const isActivePath = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export function PublicSiteHeader({
  settings,
}: {
  settings: SiteSettingsValue | null;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const hospitalName = settings?.hospitalName?.trim() || "Hospital Booking";
  const logo = settings?.logo?.trim();
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
    window.setTimeout(openPublicConsultation, mobileOpen ? 120 : 0);
  };

  return (
    <>
      <div className="hidden border-b border-[var(--public-border)] bg-[var(--public-primary-dark)] text-white lg:block">
        <div className="ui-container flex min-h-9 items-center justify-between gap-6 text-xs">
          <div className="flex min-w-0 items-center gap-5 text-white/78">
            <span className="inline-flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
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
              className="inline-flex items-center gap-1.5 font-semibold text-white/86 transition hover:text-white"
            >
              <MessageCircleQuestion className="h-3.5 w-3.5" aria-hidden="true" />
              Yêu cầu tư vấn
            </button>
            <a
              href={`tel:${hotline}`}
              className="inline-flex items-center gap-1.5 font-semibold text-white transition hover:text-[var(--public-accent)]"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
              {hotline}
            </a>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-50 border-b border-[var(--public-border)] bg-white/96 shadow-[0_1px_0_rgba(7,91,88,0.04)] backdrop-blur-xl">
        <div className="ui-container flex min-h-[4.5rem] items-center justify-between gap-4 py-2">
          <Link href="/" onClick={() => setMobileOpen(false)} className="group flex min-w-0 items-center gap-3" aria-label={`${hospitalName} - Trang chủ`}>
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[var(--public-border)] bg-[var(--public-primary-soft)] text-[var(--public-primary)] transition group-hover:-translate-y-0.5">
              {logo ? (
                <Image
                  src={logo}
                  alt=""
                  fill
                  sizes="44px"
                  unoptimized
                  className="object-contain p-1.5"
                />
              ) : (
                <HeartPulse className="h-6 w-6" aria-hidden="true" />
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[0.98rem] font-bold tracking-[-0.015em] text-[var(--public-ink)] sm:text-base">
                {hospitalName}
              </span>
              <span className="block truncate text-[0.7rem] font-medium uppercase tracking-[0.12em] text-[var(--public-muted)]">
                Chăm sóc chủ động
              </span>
            </span>
          </Link>

          <nav aria-label="Điều hướng chính" className="hidden items-center gap-0.5 xl:flex">
            {navItems.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                    active
                      ? "bg-[var(--public-primary-soft)] text-[var(--public-primary-dark)]"
                      : "text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)] hover:text-[var(--public-primary)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Link
              href="/search"
              aria-label="Tìm kiếm dịch vụ"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--public-border)] text-[var(--public-text-soft)] transition hover:border-[var(--public-primary)] hover:bg-[var(--public-primary-soft)] hover:text-[var(--public-primary)]"
            >
              <Search className="h-4.5 w-4.5" aria-hidden="true" />
            </Link>
            <Link
              href="/appointments/lookup"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[var(--public-text-soft)] transition hover:bg-[var(--public-surface-muted)] hover:text-[var(--public-primary)]"
            >
              <CalendarCheck className="h-4 w-4" aria-hidden="true" />
              Tra cứu lịch
            </Link>
            <Link
              href="/#booking"
              className="public-button-primary inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-bold"
            >
              Đặt lịch khám
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((current) => !current)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--public-border)] text-[var(--public-text-soft)] transition hover:bg-[var(--public-surface-muted)] lg:hidden"
            aria-label={mobileOpen ? "Đóng menu" : "Mở menu"}
            aria-expanded={mobileOpen}
            aria-controls="public-site-mobile-navigation"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {mobileOpen ? (
          <div
            id="public-site-mobile-navigation"
            className="fixed inset-x-0 top-[4.5rem] z-50 min-h-[calc(100dvh-4.5rem)] max-h-[calc(100dvh-4.5rem)] overflow-y-auto border-t border-[var(--public-border)] bg-white px-4 py-5 shadow-2xl lg:hidden"
          >
            <nav aria-label="Điều hướng trên điện thoại" className="mx-auto max-w-lg space-y-1">
              {navItems.map((item) => {
                const active = isActivePath(pathname, item.href);
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
              <Link href="/search" onClick={() => setMobileOpen(false)} className="block min-h-12 rounded-xl px-4 py-3 text-sm font-semibold text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]">
                Tìm kiếm dịch vụ
              </Link>
              <Link href="/appointments/lookup" onClick={() => setMobileOpen(false)} className="block min-h-12 rounded-xl px-4 py-3 text-sm font-semibold text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]">
                Tra cứu lịch hẹn
              </Link>
              <button
                type="button"
                onClick={openConsultation}
                className="block min-h-12 w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]"
              >
                Yêu cầu tư vấn
              </button>
              <div className="grid grid-cols-2 gap-2 pt-4">
                <a href={`tel:${hotline}`} className="public-button-secondary inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold">
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  Gọi hỗ trợ
                </a>
                <Link href="/#booking" onClick={() => setMobileOpen(false)} className="public-button-primary inline-flex min-h-12 items-center justify-center rounded-xl px-3 text-sm font-bold">
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
