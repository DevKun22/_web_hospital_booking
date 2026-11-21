"use client";

import * as React from "react";
import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { DsButton } from "@/components/ds/button";
import { useDsRoot } from "@/components/ds/ds-root";

// Hộp thoại giữa màn hình cho một hành động ngắn (hủy, thu tiền, hoàn tiền, đổi lịch, thêm thuốc): biểu mẫu mở ra khi cần
// thay vì chiếm chỗ cố định trong trang. Dùng Dialog của Radix nên có khóa tiêu điểm, đóng bằng Esc, trả tiêu điểm về nơi mở.
// Gắn vào DsRoot để nhận đúng biến màu.

export function DsDialog({
  open,
  onOpenChange,
  title,
  badge,
  description,
  footer,
  size = "md",
  dismissOnOutsideClick = true,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Nhãn trạng thái đứng cạnh tiêu đề. */
  badge?: React.ReactNode;
  /** Mô tả ngắn cho trình đọc màn hình (và hiện dưới tiêu đề). */
  description?: string;
  /** Hàng nút hành động cuối hộp thoại. */
  footer?: React.ReactNode;
  /** xl: gần kín màn hình, cho việc dài như soạn bài (điện thoại thì kín hẳn). */
  size?: "sm" | "md" | "lg" | "xl";
  /** false: bấm ra ngoài không đóng (hộp có dữ liệu chưa lưu); Esc và nút đóng vẫn dùng được. */
  dismissOnOutsideClick?: boolean;
  children?: React.ReactNode;
}) {
  const container = useDsRoot();
  const openerRef = React.useRef<HTMLElement | null>(null);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={container ?? undefined}>
        <Dialog.Overlay className="ds-dialog-overlay" />
        <Dialog.Content
          className={cn("ds ds-dialog", `ds-dialog--${size}`)}
          onInteractOutside={(event) => {
            if (!dismissOnOutsideClick) event.preventDefault();
          }}
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
          <div className="ds-dialog__head">
            <div className="ds-dialog__heading">
              <div className="ds-dialog__titlerow">
                <Dialog.Title className="ds-dialog__title">{title}</Dialog.Title>
                {badge}
              </div>
              {description ? <Dialog.Description className="ds-dialog__desc">{description}</Dialog.Description> : null}
            </div>
            <Dialog.Close asChild>
              <DsButton variant="ghost" icon aria-label="Đóng">
                <X />
              </DsButton>
            </Dialog.Close>
          </div>
          {children ? <div className="ds-dialog__body">{children}</div> : null}
          {footer ? <div className="ds-dialog__foot">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---- Hộp xác nhận dùng chung, thay window.confirm: `const confirm = useConfirm(); if (!(await confirm({...}))) return;` ----

type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger: nút xác nhận màu đỏ (xóa, hủy, thao tác không hoàn tác). */
  tone?: "default" | "danger";
};

export type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmFn | null>(null);

export function DsConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<{ options: ConfirmOptions; resolve: (value: boolean) => void } | null>(null);

  const confirm = React.useCallback<ConfirmFn>(
    (options) =>
      new Promise<boolean>((resolve) => {
        setPending((current) => {
          // Một hộp xác nhận mới thay hộp đang mở: hộp cũ coi như bị từ chối.
          current?.resolve(false);
          return { options, resolve };
        });
      }),
    [],
  );

  const settle = (value: boolean) => {
    pending?.resolve(value);
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <DsDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) settle(false);
        }}
        title={pending?.options.title ?? ""}
        description={pending?.options.message}
        size="sm"
        footer={
          <>
            <DsButton onClick={() => settle(false)}>{pending?.options.cancelLabel ?? "Hủy"}</DsButton>
            <DsButton variant={pending?.options.tone === "danger" ? "danger" : "primary"} onClick={() => settle(true)}>
              {pending?.options.confirmLabel ?? "Xác nhận"}
            </DsButton>
          </>
        }
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const confirm = React.useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm phải dùng bên trong DsConfirmProvider");
  return confirm;
}
