"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

export function ThemeToggle({
  showLabel = false,
  className = "",
}: {
  showLabel?: boolean;
  className?: string;
}) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  const actionLabel = dark
    ? "Chuyển sang giao diện sáng"
    : "Chuyển sang giao diện tối";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={actionLabel}
      aria-pressed={dark}
      title={actionLabel}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--public-border)] bg-[var(--public-surface)] px-3 text-sm font-semibold text-[var(--public-text-soft)] transition-colors hover:bg-[var(--public-surface-muted)] hover:text-[var(--public-primary)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--public-primary-soft)] ${className}`}
    >
      {dark ? (
        <Sun className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" aria-hidden="true" />
      )}
      {showLabel ? <span>{dark ? "Nền sáng" : "Nền tối"}</span> : null}
    </button>
  );
}
