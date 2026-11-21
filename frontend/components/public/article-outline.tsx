"use client";

import { useEffect, useState } from "react";

// Mục lục bài viết: mục đang đọc được tô đậm theo vị trí cuộn; không có JavaScript vẫn là danh sách liên kết thường.
export function ArticleOutline({ items }: { items: { id: string; text: string }[] }) {
  const [active, setActive] = useState("");

  useEffect(() => {
    const headings = items.map((item) => document.getElementById(item.id)).filter((node): node is HTMLElement => Boolean(node));
    if (!headings.length || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -65% 0px" },
    );
    headings.forEach((heading) => observer.observe(heading));
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav aria-label="Mục lục" className="rounded-2xl border border-[var(--public-border)] bg-[var(--public-surface)] p-4">
      <p className="text-base font-semibold">Trong bài viết</p>
      <ol className="mt-3 space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              aria-current={active === item.id ? "location" : undefined}
              className={active === item.id ? "font-semibold text-[var(--public-primary)]" : "text-[var(--public-text-soft)] hover:text-[var(--public-primary)]"}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
