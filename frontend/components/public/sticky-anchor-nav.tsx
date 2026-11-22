"use client";

import { useEffect, useState } from "react";

// Thanh mục dính dưới header khi cuộn trang chi tiết: bấm để nhảy tới mục, mục đang xem sáng lên (tính theo vị trí cuộn như thanh dịch vụ ở trang chủ).
export function StickyAnchorNav({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState("");

  useEffect(() => {
    let frame = 0;
    const compute = () => {
      frame = 0;
      const line = window.innerHeight * 0.3;
      let current = "";
      let best = -Infinity;
      for (const item of items) {
        const rect = document.getElementById(item.id)?.getBoundingClientRect();
        if (rect && rect.top <= line && rect.bottom > 0 && rect.top > best) {
          best = rect.top;
          current = item.id;
        }
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(compute);
    };
    const timer = window.setTimeout(compute, 0);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [items]);

  if (items.length < 2) return null;
  return (
    <nav aria-label="Nội dung trang" className="sticky top-[7.6rem] z-30 mt-5 -mx-4 border-b border-[var(--public-border)] bg-[var(--public-canvas)]/95 px-4 backdrop-blur sm:mx-0 sm:px-0 xl:top-[4.25rem]">
      <ul className="flex gap-1.5 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => (
          <li key={item.id} className="shrink-0">
            <a
              href={`#${item.id}`}
              aria-current={active === item.id ? "location" : undefined}
              className={`inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm font-medium transition-colors ${
                active === item.id
                  ? "border-[var(--public-primary)] bg-[var(--public-primary-soft)] font-semibold text-[var(--public-primary-dark)]"
                  : "border-[var(--public-border)] bg-[var(--public-surface)] text-[var(--public-text-soft)] hover:border-[var(--public-primary)] hover:text-[var(--public-primary)]"
              }`}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
