"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { scrollProgress } from "@/lib/scroll-progress";

// Thanh điều hướng phụ dưới header: bốn mục dịch vụ, không gọi API. Ở trang chủ là liên kết cuộn tới đúng mục (mục đang xem tô đậm, vạch dưới chạy theo
// tiến độ cuộn); ở các trang khác dẫn tới trang tương ứng. Trên điện thoại là dải chip cuộn ngang.

const ITEMS = [
  { key: "departments", label: "Chuyên khoa", href: "/chuyen-khoa", anchor: "departments" },
  { key: "packages", label: "Gói khám", href: "/goi-kham", anchor: "packages" },
  { key: "doctors", label: "Bác sĩ", href: "/bac-si", anchor: "doctors" },
  { key: "articles", label: "Kiến thức", href: "/kien-thuc", anchor: "kien-thuc" },
] as const;

const isActivePath = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

const ITEM_CLASS = "inline-flex min-h-10 shrink-0 items-center rounded-full border px-3.5 text-sm transition-colors md:rounded-none md:border-transparent md:px-4";
const ACTIVE_CLASS = "border-[var(--public-primary)] bg-[var(--public-primary-soft)] font-semibold text-[var(--public-primary-dark)] md:bg-transparent md:shadow-[inset_0_-2px_0_var(--public-primary)]";
const IDLE_CLASS = "border-[var(--public-border)] text-[var(--public-text-soft)] hover:text-[var(--public-primary)]";

export function PublicSubNav({ pathname }: { pathname: string }) {
  const home = pathname === "/";
  const [present, setPresent] = useState<string[] | null>(null);
  const [active, setActive] = useState("");
  const barRef = useRef<HTMLSpanElement | null>(null);

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
      window.clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [home]);

  const items = home && present ? ITEMS.filter((item) => present.includes(item.key)) : ITEMS;

  return (
    <nav aria-label="Mục dịch vụ" className="relative border-t border-[var(--public-border)]">
      <ul className="ui-container flex gap-1.5 overflow-x-auto py-1.5 md:gap-0 md:py-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const current = home ? active === item.key : isActivePath(pathname, item.href);
          const className = `${ITEM_CLASS} ${current ? ACTIVE_CLASS : IDLE_CLASS}`;
          return (
            <li key={item.key} className="shrink-0">
              {home ? (
                <a href={`#${item.anchor}`} aria-current={current ? "location" : undefined} className={className}>{item.label}</a>
              ) : (
                <Link href={item.href} aria-current={current ? "page" : undefined} className={className}>{item.label}</Link>
              )}
            </li>
          );
        })}
      </ul>
      {home ? <span ref={barRef} aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-[var(--public-primary)]" /> : null}
    </nav>
  );
}
