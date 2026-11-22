"use client";

import * as React from "react";
import { DsDialog, useConfirm } from "@/components/ds/dialog";

// Hộp thoại tạo hoặc sửa: thay cho DsPane ở các biểu mẫu, để thao tác nhập liệu nằm giữa màn hình thay vì chiếm một nửa trang.
// Có mặt trong cây là đang mở (trang chỉ dựng nó khi có mục đang tạo hoặc sửa); đóng bằng nút X, Esc hoặc onClose.
// Bấm ra ngoài không đóng, tránh mất dữ liệu đang nhập. Cùng giao diện với DsPane nên đổi qua lại chỉ là đổi tên thành phần.
// Nếu người dùng đã gõ hoặc chọn gì trong hộp (sự kiện input nổi lên từ nội dung) thì đóng bằng X hoặc Esc sẽ hỏi lại trước khi bỏ. Nút Hủy/Đóng do trang tự vẽ
// và việc tự đóng sau khi lưu gọi thẳng onClose của trang nên không bị hỏi.
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
  const confirm = useConfirm();
  const touched = React.useRef(false);

  const requestClose = async () => {
    if (touched.current) {
      const discard = await confirm({
        title: "Bỏ thay đổi chưa lưu?",
        message: "Những gì bạn đã nhập trong hộp này sẽ bị mất.",
        confirmLabel: "Bỏ thay đổi",
        cancelLabel: "Tiếp tục nhập",
        tone: "danger",
      });
      if (!discard) return;
    }
    onClose();
  };

  return (
    <DsDialog open onOpenChange={(open) => (open ? undefined : void requestClose())} title={title} badge={badge} footer={footer} size={size} dismissOnOutsideClick={false}>
      <div style={{ display: "contents" }} onInput={() => { touched.current = true; }}>
        {children}
      </div>
    </DsDialog>
  );
}
