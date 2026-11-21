"use client";

import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { usePatientLookupLink } from "@/lib/patient-session-client";
import { fetchPublicDepartments, fetchPublicPackages } from "@/lib/public-lists-query";
import type { PublicArticleList } from "@/lib/types";

// Thanh điều hướng chính của header máy tính: mỗi mục là một liên kết thật tới trang chính của nó (robot và người dùng không bật JavaScript vẫn đi được),
// kèm nút mở menu con liệt kê lối vào nhanh từ dữ liệu thật (chuyên khoa, gói khám, danh mục bài viết). Dữ liệu chỉ được tải khi người dùng mở menu lần đầu.

type NavLink = { href: string; label: string; hint?: string };
type NavSection = { heading?: string; links: NavLink[] };
type NavMenuContent = { sections: NavSection[]; footer: NavLink; loading: boolean };

type NavData = {
  departments: { id: string; name: string; slug: string | null }[];
  packages: { id: string; name: string; slug: string | null }[];
  categories: { name: string; count: number }[];
  loading: boolean;
  lookup: { href: string; label: string };
};

const STALE_MS = 10 * 60_000;
const MAX_DEPARTMENTS = 8;
const MAX_PACKAGES = 5;
const MAX_CATEGORIES = 6;

function usePublicNavData(enabled: boolean): NavData {
  const lookup = usePatientLookupLink();
  const departments = useQuery({ queryKey: ["public-nav", "departments"], queryFn: () => fetchPublicDepartments(), enabled, staleTime: STALE_MS });
  const packages = useQuery({ queryKey: ["public-nav", "packages"], queryFn: () => fetchPublicPackages(), enabled, staleTime: STALE_MS });
  const articles = useQuery({
    queryKey: ["public-nav", "article-categories"],
    queryFn: () => apiRequest<PublicArticleList>("/articles", { query: { limit: 1 } }),
    enabled,
    staleTime: STALE_MS,
  });
  return {
    departments: (departments.data ?? []).slice(0, MAX_DEPARTMENTS),
    packages: (packages.data ?? []).slice(0, MAX_PACKAGES),
    categories: (articles.data?.categories ?? []).slice(0, MAX_CATEGORIES),
    lookup,
    loading: enabled && (departments.isLoading || packages.isLoading || articles.isLoading),
  };
}

type MenuDef = {
  key: string;
  href: string;
  label: string;
  aliases: string[];
  content: (data: NavData) => NavMenuContent;
};

const MENUS: MenuDef[] = [
  {
    key: "departments",
    href: "/chuyen-khoa",
    label: "Chuyên khoa",
    aliases: [],
    content: (data) => ({
      sections: [{ links: data.departments.map((item) => ({ href: item.slug ? `/chuyen-khoa/${item.slug}` : "/chuyen-khoa", label: item.name })) }],
      footer: { href: "/chuyen-khoa", label: "Tất cả chuyên khoa" },
      loading: data.loading,
    }),
  },
  {
    key: "doctors",
    href: "/bac-si",
    label: "Bác sĩ",
    aliases: [],
    content: (data) => ({
      sections: [
        {
          links: [
            { href: "/bac-si?availableToday=true", label: "Có giờ trống hôm nay" },
            { href: "/bac-si", label: "Tất cả bác sĩ" },
          ],
        },
        {
          heading: "Theo chuyên khoa",
          links: data.departments.slice(0, 6).map((item) => ({ href: `/bac-si?departmentId=${item.id}`, label: item.name })),
        },
      ],
      footer: { href: "/dat-lich", label: "Đặt lịch với bác sĩ" },
      loading: data.loading,
    }),
  },
  {
    key: "packages",
    href: "/goi-kham",
    label: "Gói khám",
    aliases: [],
    content: (data) => ({
      sections: [{ links: data.packages.map((item) => ({ href: `/goi-kham/${item.slug || item.id}`, label: item.name })) }],
      footer: { href: "/goi-kham", label: "Tất cả gói khám" },
      loading: data.loading,
    }),
  },
  {
    key: "articles",
    href: "/kien-thuc",
    label: "Kiến thức",
    aliases: [],
    content: (data) => ({
      sections: [
        {
          links: data.categories.map((item) => ({
            href: `/kien-thuc?category=${encodeURIComponent(item.name)}`,
            label: item.name,
            hint: String(item.count),
          })),
        },
      ],
      footer: { href: "/kien-thuc", label: "Tất cả bài viết" },
      loading: data.loading,
    }),
  },
  {
    key: "support",
    href: "/ho-tro",
    label: "Hỗ trợ",
    aliases: ["/hoi-dap", "/huong-dan"],
    content: (data) => ({
      sections: [
        {
          links: [
            { href: "/huong-dan/dat-lich", label: "Hướng dẫn đặt lịch" },
            { href: "/hoi-dap", label: "Câu hỏi thường gặp" },
            { href: data.lookup.href, label: data.lookup.label },
          ],
        },
      ],
      footer: { href: "/ho-tro", label: "Liên hệ và địa điểm khám" },
      loading: false,
    }),
  },
];

const isActivePath = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

const CLOSE_DELAY_MS = 140;

export function PublicNavMenu({ pathname }: { pathname: string }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [primed, setPrimed] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);
  const closeTimer = useRef<number | null>(null);
  const data = usePublicNavData(primed);
  const panelId = useId();

  const clearTimer = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const open = useCallback((key: string) => {
    clearTimer();
    setPrimed(true);
    setOpenKey(key);
  }, []);
  const closeSoon = () => {
    clearTimer();
    closeTimer.current = window.setTimeout(() => setOpenKey(null), CLOSE_DELAY_MS);
  };

  // Đổi trang thì đóng menu; bấm ra ngoài hoặc nhấn Esc cũng đóng.
  useEffect(() => {
    const timer = window.setTimeout(() => setOpenKey(null), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (!openKey) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpenKey(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenKey(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openKey]);

  return (
    <nav ref={rootRef} aria-label="Điều hướng chính" className="flex min-w-0 items-center gap-0.5">
      <Link
        href="/"
        aria-current={pathname === "/" ? "page" : undefined}
        className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${pathname === "/" ? "text-[var(--public-primary)]" : "text-[var(--public-text-soft)] hover:text-[var(--public-primary)]"}`}
      >
        Trang chủ
      </Link>
      {MENUS.map((menu) => {
        const active = isActivePath(pathname, menu.href) || menu.aliases.some((href) => isActivePath(pathname, href));
        const isOpen = openKey === menu.key;
        const content = menu.content(data);
        const hasLinks = content.sections.some((section) => section.links.length);
        return (
          <div key={menu.key} className="relative" onMouseEnter={() => open(menu.key)} onMouseLeave={closeSoon}>
            <div className={`flex items-center rounded-lg ${active ? "text-[var(--public-primary)]" : "text-[var(--public-text-soft)]"}`}>
              <Link
                href={menu.href}
                aria-current={active ? "page" : undefined}
                className="rounded-l-lg py-2 pl-3 pr-0.5 text-sm font-medium transition-colors hover:text-[var(--public-primary)]"
              >
                {menu.label}
              </Link>
              <button
                type="button"
                aria-label={`${isOpen ? "Đóng" : "Mở"} menu ${menu.label}`}
                aria-expanded={isOpen}
                aria-controls={`${panelId}-${menu.key}`}
                onClick={() => (isOpen ? setOpenKey(null) : open(menu.key))}
                className="rounded-r-lg py-2 pl-0.5 pr-2 transition-colors hover:text-[var(--public-primary)]"
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
            </div>
            {active ? <span aria-hidden="true" className="absolute inset-x-3 -bottom-[0.9rem] h-0.5 rounded bg-[var(--public-primary)]" /> : null}

            {isOpen ? (
              <div
                id={`${panelId}-${menu.key}`}
                className="absolute left-0 top-full z-50 pt-2"
                onMouseEnter={() => open(menu.key)}
                onMouseLeave={closeSoon}
              >
                <div className="min-w-64 max-w-80 overflow-hidden rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] shadow-xl">
                  <div className="max-h-[22rem] overflow-y-auto p-2">
                    {content.loading && !hasLinks ? (
                      <div className="space-y-2 p-2" aria-busy="true">
                        {[0, 1, 2, 3].map((index) => (
                          <span key={index} className="skeleton-shimmer block h-5 rounded" />
                        ))}
                      </div>
                    ) : (
                      content.sections.map((section, index) =>
                        section.links.length ? (
                          <div key={index} className={index > 0 ? "mt-1 border-t border-[var(--public-divider)] pt-1" : ""}>
                            {section.heading ? <p className="px-3 pb-1 pt-2 text-xs font-medium text-[var(--public-muted)]">{section.heading}</p> : null}
                            <ul>
                              {section.links.map((link) => (
                                <li key={`${link.href}-${link.label}`}>
                                  <Link
                                    href={link.href}
                                    className="flex min-h-10 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-[var(--public-text-soft)] transition-colors hover:bg-[var(--public-primary-soft)] hover:text-[var(--public-primary-dark)]"
                                  >
                                    <span className="min-w-0 truncate">{link.label}</span>
                                    {link.hint ? <span className="shrink-0 text-xs tabular-nums text-[var(--public-muted)]">{link.hint}</span> : null}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null,
                      )
                    )}
                  </div>
                  <Link
                    href={content.footer.href}
                    className="flex min-h-11 items-center justify-between gap-2 border-t border-[var(--public-divider)] bg-[var(--public-surface-muted)] px-4 py-2.5 text-sm font-medium text-[var(--public-primary)] hover:text-[var(--public-primary-dark)]"
                  >
                    {content.footer.label}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
