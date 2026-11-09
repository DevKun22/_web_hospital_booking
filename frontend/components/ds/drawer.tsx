"use client";

import * as React from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { DsButton } from "@/components/ds/button";
import { useDsRoot } from "@/components/ds/ds-root";

// Ngăn bên: chi tiết của hàng đang chọn. Dùng Dialog của Radix nên có khóa tiêu điểm,
// đóng bằng Esc và trả tiêu điểm về nút mở; gắn vào DsRoot để nhận đúng biến màu.
export function DsDrawer({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const container = useDsRoot();

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={container ?? undefined}>
        <Dialog.Overlay className="ds-drawer-overlay" />
        <Dialog.Content className="ds ds-drawer">
          <div className="ds-drawer__head">
            <Dialog.Title className="ds-drawer__title">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <DsButton variant="ghost" icon aria-label="Đóng">
                <X />
              </DsButton>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{description}</Dialog.Description>
          <div className="ds-drawer__body">{children}</div>
          {footer ? <div className="ds-drawer__foot">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
