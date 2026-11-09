"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type DsTabItem = { id: string; label: string; count?: number };

// Thanh tab theo mẫu WAI-ARIA: mũi tên trái/phải đổi tab, Home/End nhảy đầu/cuối.
export function DsTabs({
  items,
  value,
  onChange,
  label,
  className,
}: {
  items: DsTabItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  className?: string;
}) {
  const refs = React.useRef<Record<string, HTMLButtonElement | null>>({});

  const focusTab = (index: number) => {
    const target = items[(index + items.length) % items.length];
    onChange(target.id);
    refs.current[target.id]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className={cn("ds-tabs", className)}>
      {items.map((item, index) => (
        <button
          key={item.id}
          ref={(node) => {
            refs.current[item.id] = node;
          }}
          type="button"
          role="tab"
          id={`ds-tab-${item.id}`}
          aria-selected={item.id === value}
          tabIndex={item.id === value ? 0 : -1}
          className="ds-tab"
          onClick={() => onChange(item.id)}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") {
              event.preventDefault();
              focusTab(index + 1);
            } else if (event.key === "ArrowLeft") {
              event.preventDefault();
              focusTab(index - 1);
            } else if (event.key === "Home") {
              event.preventDefault();
              focusTab(0);
            } else if (event.key === "End") {
              event.preventDefault();
              focusTab(items.length - 1);
            }
          }}
        >
          {item.label}
          {item.count !== undefined ? <span className="ds-tab__count">{item.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
