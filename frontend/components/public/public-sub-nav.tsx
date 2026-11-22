"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { scrollProgress } from "@/lib/scroll-progress";

// Bốn mục dịch vụ nằm ngay trong hàng điều hướng chính (không gọi API). Ở trang chủ là liên kết cuộn tới đúng mục (mục đang xem tô đậm, vạch dưới header
// chạy theo tiến độ cuộn); ở các trang khác dẫn tới trang tương ứng. Dưới 1280px hiện thành dải chip cuộn ngang dưới header.

const ITEMS = [
  { key: "departments", label: "Chuyên khoa", href: "/chuyen-khoa", anchor: "departments" },
  { key: "packages", label: "Gói khám", href: "/goi-kham", anchor: "packages" },
  { key: "doctors", label: "Bác sĩ", href: "/bac-si", anchor: "doctors" },
  { key: "articles", label: "Kiến thức", href: "/kien-thuc", anchor: "kien-thuc" },
] as const;

const isActivePath = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

const INLINE_CLASS = "rounded-lg px-3 py-2 text-sm font-medium transition-colors";
const INLINE_ACTIVE = "font-semibold text-[var(--public-primary)]";
const INLINE_IDLE = "text-[var(--public-text-soft)] hover:text-[var(--public-primary)]";
const CHIP_CLASS = "inline-flex min-h-10 shrink-0 items-center rounded-full border px-3.5 text-sm transition-colors";
const CHIP_ACTIVE = "border-[var(--public-primary)] bg-[var(--public-primary-soft)] font-semibold text-[var(--public-primary-dark)]";
const CHIP_IDLE = "border-[var(--public-border)] text-[var(--public-text-soft)] hover:text-[var(--public-primary)]";

export type ServiceNavState = {
  home: boolean;
  pathname: string;
  items: readonly (typeof ITEMS)[number][];
  active: string;
};

export function useServiceNav(pathname: string): ServiceNavState {
  const home = pathname === "/";
  const [present, setPresent] = useState<string[] | null>(null);
  const [active, setActive] = useState("");

  // Trang chủ: chỉ giữ những mục thật sự có trên trang (quản trị có thể tắt mục), theo dõi mục đang xem và tiến độ cuộn.
  useEffect(() => {
    if (!home) return;
    const found = ITEMS.filter((item) => document.getElementById(item.anchor));
    const timer = window.setTimeout(() => setPresent(found.map((item) => item.key)), 0);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const item = ITEMS.find((candidate) => candidate.anchor === entry.target.id);
          if (item) setActive(item.key);
        }
      },
      { rootMargin: "-25% 0px -65% 0px" },
    );
    found.forEach((item) => {
      const element = document.getElementById(item.anchor);
      if (element) observer.observe(element);
    });

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [home]);

  const items = home && present ? ITEMS.filter((item) => present.includes(item.key)) : ITEMS;
  return { home, pathname, items, active };
}

function NavLink({ nav, item, chip }: { nav: ServiceNavState; item: (typeof ITEMS)[number]; chip: boolean }) {
  const current = nav.home ? nav.active === item.key : isActivePath(nav.pathname, item.href);
  const className = chip
    ? `${CHIP_CLASS} ${current ? CHIP_ACTIVE : CHIP_IDLE}`
    : `${INLINE_CLASS} ${current ? INLINE_ACTIVE : INLINE_IDLE}`;
  return nav.home ? (
    <a href={`#${item.anchor}`} aria-current={current ? "location" : undefined} className={className}>{item.label}</a>
  ) : (
    <Link href={item.href} aria-current={current ? "page" : undefined} className={className}>{item.label}</Link>
  );
}

/** Các mục nằm thẳng trong hàng điều hướng chính (từ 1280px). */
export function ServiceNavInline({ nav }: { nav: ServiceNavState }) {
  return (
    <>
      {nav.items.map((item) => <NavLink key={item.key} nav={nav} item={item} chip={false} />)}
    </>
  );
}

/** Dải chip cuộn ngang dưới header (dưới 1280px). */
export function ServiceNavChips({ nav }: { nav: ServiceNavState }) {
  return (
    <nav aria-label="Mục dịch vụ" className="border-t border-[var(--public-border)] xl:hidden">
      <ul className="ui-container flex gap-1.5 overflow-x-auto py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {nav.items.map((item) => (
          <li key={item.key} className="shrink-0"><NavLink nav={nav} item={item} chip /></li>
        ))}
      </ul>
    </nav>
  );
}

/** Vạch tiến độ cuộn ở đáy header (chỉ trang chủ). */
export function ServiceNavProgress({ home }: { home: boolean }) {
  const barRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!home) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const content = document.getElementById("home-content");
      const bar = barRef.current;
      if (!content || !bar) return;
      const top = content.getBoundingClientRect().top + window.scrollY;
      bar.style.transform = `scaleX(${scrollProgress(window.scrollY, top, content.offsetHeight, window.innerHeight)})`;
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [home]);
  if (!home) return null;
  return <span ref={barRef} aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-[var(--public-primary)]" />;
}
