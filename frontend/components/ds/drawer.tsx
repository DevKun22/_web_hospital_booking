"use client";

import * as React from "react";
import { Dialog } from "radix-ui";
import { cn } from "@/lib/utils";
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
  side = "right",
  flush = false,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  footer?: React.ReactNode;
  /** Cạnh màn hình mà ngăn trượt ra: phải cho chi tiết, trái cho điều hướng. */
  side?: "right" | "left";
  /** Không đệm phần thân (dùng cho danh sách điều hướng). */
  flush?: boolean;
  children: React.ReactNode;
}) {
  const container = useDsRoot();
  // Ngăn bên thường mở từ một hàng của bảng (không phải nút Trigger của Radix), nên tự ghi nhớ
  // phần tử đang có tiêu điểm lúc mở để trả tiêu điểm về đó khi đóng.
  const openerRef = React.useRef<HTMLElement | null>(null);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={container ?? undefined}>
        <Dialog.Overlay className="ds-drawer-overlay" />
        <Dialog.Content
          className={cn("ds ds-drawer", side === "left" && "ds-drawer--left")}
          onOpenAutoFocus={() => {
            openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            const opener = openerRef.current;
            if (opener && opener.isConnected) {
              event.preventDefault();
              opener.focus();
            }
          }}
        >
          <div className="ds-drawer__head">
            <Dialog.Title className="ds-drawer__title">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <DsButton variant="ghost" icon aria-label="Đóng">
                <X />
              </DsButton>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{description}</Dialog.Description>
          <div className={cn("ds-drawer__body", flush && "ds-drawer__body--flush")}>{children}</div>
          {footer ? <div className="ds-drawer__foot">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
