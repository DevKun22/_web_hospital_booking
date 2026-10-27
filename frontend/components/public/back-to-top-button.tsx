"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";
import { PUBLIC_FLOATING_PANEL_VISIBILITY_EVENT } from "@/lib/public-ui-events";

export function BackToTopButton() {
  const [visible, setVisible] = useState(false);
  const [floatingPanelOpen, setFloatingPanelOpen] = useState(false);

  useEffect(() => {
    const updateVisibility = () => {
      setVisible(window.scrollY > 240);
    };

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });

    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  useEffect(() => {
    const updatePanelVisibility = (event: Event) => {
      setFloatingPanelOpen((event as CustomEvent<boolean>).detail);
    };
    window.addEventListener(
      PUBLIC_FLOATING_PANEL_VISIBILITY_EVENT,
      updatePanelVisibility,
    );
    return () =>
      window.removeEventListener(
        PUBLIC_FLOATING_PANEL_VISIBILITY_EVENT,
        updatePanelVisibility,
      );
  }, []);

  if (!visible || floatingPanelOpen) return null;

  return (
    <div className="public-floating-utility fixed bottom-[calc(max(1rem,env(safe-area-inset-bottom))+3.75rem)] right-3 z-[80] flex items-center gap-2 sm:bottom-6 sm:right-6">
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="ui-floating-callout ui-soft-glow hidden min-h-11 rounded-xl border border-[var(--public-border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--public-text-soft)] shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-[var(--public-surface-muted)] sm:inline-flex sm:items-center"
      >
        Lên đầu trang
      </button>
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--public-border)] bg-white text-[var(--public-primary)] shadow-lg shadow-black/15 transition hover:-translate-y-0.5 hover:bg-[var(--public-primary-soft)] focus:outline-none focus:ring-4 focus:ring-[var(--public-primary-soft)]"
        aria-label="Cuộn lên đầu trang"
        title="Cuộn lên đầu trang"
      >
        <ArrowUp className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
