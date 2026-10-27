"use client";

import type { ReactNode } from "react";
import { PanelRightClose, PanelRightOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DashboardWorkspace({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-4 text-sm font-semibold text-primary transition hover:bg-primary/15"
      >
        <PanelRightOpen className="size-4" aria-hidden="true" />
        Mở {title.toLocaleLowerCase("vi")}
      </button>
    );
  }

  return (
    <aside
      className={cn(
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-3 scroll-mt-24 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-md)] motion-safe:duration-200 xl:sticky xl:top-24 xl:self-start",
        className,
      )}
      aria-label={title}
    >
      <div className="flex items-start gap-3 border-b border-border bg-muted/35 px-4 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{title}</h2>
          {description ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p> : null}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onOpenChange(false)}
          aria-label={`Đóng ${title.toLocaleLowerCase("vi")}`}
          title="Thu gọn không gian làm việc"
        >
          <PanelRightClose className="hidden size-4 sm:block" aria-hidden="true" />
          <X className="size-4 sm:hidden" aria-hidden="true" />
        </Button>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </aside>
  );
}
