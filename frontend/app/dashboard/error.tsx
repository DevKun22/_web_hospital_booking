"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <section
      className="mx-auto flex min-h-[28rem] max-w-2xl flex-col items-center justify-center rounded-2xl border border-destructive/20 bg-card p-8 text-center shadow-sm"
      role="alert"
    >
      <div className="flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" aria-hidden="true" />
      </div>
      <h2 className="mt-5 text-xl font-semibold">Không thể tải màn hình quản trị</h2>
      <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
        Hệ thống gặp sự cố khi hiển thị dữ liệu. Bạn có thể thử tải lại phần nội dung này mà không cần rời dashboard.
      </p>
      {error.digest ? (
        <p className="mt-3 rounded-md bg-muted px-2.5 py-1 font-mono text-xs text-muted-foreground">
          Mã sự cố: {error.digest}
        </p>
      ) : null}
      <Button type="button" className="mt-6" onClick={unstable_retry}>
        <RefreshCw aria-hidden="true" />
        Thử tải lại
      </Button>
    </section>
  );
}
