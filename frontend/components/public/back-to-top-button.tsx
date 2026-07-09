"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

export function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => {
      setVisible(window.scrollY > 520);
    };

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });

    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-3 z-[80] flex items-center gap-2 sm:bottom-6 sm:right-6">
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="ui-floating-callout ui-soft-glow hidden rounded-md border border-[#cfe0f3] bg-white px-3 py-2 text-xs font-semibold text-[#42526b] shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-[#f8fafc] sm:inline-flex"
      >
        Lên đầu trang
      </button>
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#cfd8e6] bg-white text-[#0d4f8b] shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-[#f3f8ff] focus:outline-none focus:ring-4 focus:ring-[#cfe4fa]"
        aria-label="Cuộn lên đầu trang"
        title="Cuộn lên đầu trang"
      >
        <ArrowUp className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
}
