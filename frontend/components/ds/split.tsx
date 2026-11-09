import * as React from "react";
import { X } from "lucide-react";
import { DsButton } from "@/components/ds/button";
import { cn } from "@/lib/utils";

// Danh sách và chi tiết cạnh nhau: chi tiết mở ra chia chỗ với danh sách chứ không phủ lên nội dung
// khác. Màn hình hẹp thì chi tiết xếp xuống dưới danh sách (không bao giờ che danh sách).
export function DsSplit({
  list,
  pane,
  className,
}: {
  list: React.ReactNode;
  /** null: chưa chọn gì, danh sách chiếm toàn bề ngang. */
  pane: React.ReactNode | null;
  className?: string;
}) {
  return (
    <div className={cn("ds-split", pane ? "ds-split--open" : undefined, className)}>
      <div className="ds-split__list">{list}</div>
      {pane ? <div className="ds-split__pane">{pane}</div> : null}
    </div>
  );
}

export function DsPane({
  title,
  badge,
  onClose,
  footer,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <aside className="ds-pane" aria-label={title}>
      <div className="ds-pane__head">
        <h2 className="ds-pane__title">{title}</h2>
        {badge}
        <DsButton variant="ghost" icon aria-label="Đóng chi tiết" onClick={onClose}>
          <X />
        </DsButton>
      </div>
      <div className="ds-pane__body">{children}</div>
      {footer ? <div className="ds-pane__foot">{footer}</div> : null}
    </aside>
  );
}

// Các bước của một quy trình (ví dụ hồ sơ, kết quả, đơn thuốc) với trạng thái và nút đi tới bước đó.
export function DsStepList({
  steps,
}: {
  steps: { id: string; title: string; detail: string; done?: boolean; action?: React.ReactNode }[];
}) {
  return (
    <ol className="ds-steps">
      {steps.map((step, index) => (
        <li key={step.id} className="ds-step">
          <span className={cn("ds-step__n", step.done && "is-done")} aria-hidden="true">
            {step.done ? "✓" : index + 1}
          </span>
          <div className="ds-step__text">
            <strong>{step.title}</strong>
            <small>{step.detail}</small>
          </div>
          {step.action}
        </li>
      ))}
    </ol>
  );
}
