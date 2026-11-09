"use client";

import * as React from "react";
import { DropdownMenu } from "radix-ui";
import { cn } from "@/lib/utils";
import { useDsRoot } from "@/components/ds/ds-root";

// Menu thả xuống dùng Radix (bàn phím, tiêu điểm, Esc), gắn vào DsRoot để nhận đúng biến màu.
export function DsMenu({
  trigger,
  align = "end",
  children,
}: {
  trigger: React.ReactNode;
  align?: "start" | "center" | "end";
  children: React.ReactNode;
}) {
  const container = useDsRoot();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal container={container ?? undefined}>
        <DropdownMenu.Content align={align} sideOffset={6} className="ds ds-menu">
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function DsMenuLabel({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="ds-menu__label">
      <strong>{title}</strong>
      {subtitle ? <small>{subtitle}</small> : null}
    </div>
  );
}

export function DsMenuItem({
  onSelect,
  danger = false,
  children,
}: {
  onSelect: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu.Item className={cn("ds-menu__item", danger && "ds-menu__item--danger")} onSelect={onSelect}>
      {children}
    </DropdownMenu.Item>
  );
}

export function DsMenuSeparator() {
  return <DropdownMenu.Separator className="ds-menu__sep" />;
}
