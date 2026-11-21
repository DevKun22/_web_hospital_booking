"use client";

import * as React from "react";
import { DsDialog } from "@/components/ds/dialog";

// Hộp thoại tạo hoặc sửa: thay cho DsPane ở các biểu mẫu, để thao tác nhập liệu nằm giữa màn hình thay vì chiếm một nửa trang.
// Có mặt trong cây là đang mở (trang chỉ dựng nó khi có mục đang tạo hoặc sửa); đóng bằng nút X, Esc hoặc onClose.
// Bấm ra ngoài không đóng, tránh mất dữ liệu đang nhập. Cùng giao diện với DsPane nên đổi qua lại chỉ là đổi tên thành phần.
export function DsEditDialog({
  title,
  badge,
  onClose,
  footer,
  size = "lg",
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  /** lg: biểu mẫu thường; xl: việc dài, nhiều cột. */
  size?: "md" | "lg" | "xl";
  children: React.ReactNode;
}) {
  return (
    <DsDialog open onOpenChange={(open) => (open ? undefined : onClose())} title={title} badge={badge} footer={footer} size={size} dismissOnOutsideClick={false}>
      {children}
    </DsDialog>
  );
}
