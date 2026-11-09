import * as React from "react";
import { cn } from "@/lib/utils";

export function DsPanel({
  title,
  actions,
  className,
  bodyClassName,
  flush = false,
  children,
}: {
  title?: string;
  actions?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Không đệm nội dung: dùng khi bên trong là bảng. */
  flush?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("ds-panel", className)}>
      {title || actions ? (
        <div className="ds-panel__head">
          {title ? <h2 className="ds-panel__title">{title}</h2> : <span className="ds-panel__title" />}
          {actions}
        </div>
      ) : null}
      <div className={cn(!flush && "ds-panel__body", bodyClassName)}>{children}</div>
    </section>
  );
}

// Tiêu đề trang gọn một dòng: không có thẻ lớn, thao tác chính nằm cùng hàng.
export function DsPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="ds-page-head">
      <div className="ds-page-head__text">
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="ds-page-head__actions">{actions}</div> : null}
    </header>
  );
}

export function DsToolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("ds-toolbar", className)}>{children}</div>;
}

export function DsToolbarSpacer() {
  return <span className="ds-toolbar__spacer" />;
}

export function DsNotice({
  tone = "info",
  children,
}: {
  tone?: "info" | "good" | "warn" | "bad";
  children: React.ReactNode;
}) {
  return (
    <div className={cn("ds-notice", `ds-notice--${tone}`)} role={tone === "bad" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function DsEmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="ds-empty">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}

export function DsKeyValue({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="ds-kv">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
