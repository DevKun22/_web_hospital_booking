"use client";

import { useEffect, useState } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";

// Thanh tiến trình mảnh ở đỉnh màn hình khi có dữ liệu đang tải hoặc thao tác đang gửi (đổi trang, đổi tab, lưu...).
// Chỉ hiện sau 200 ms để các lần tải rất nhanh không nhấp nháy.
const SHOW_DELAY_MS = 200;

export function DsFetchProgress() {
  const busy = useIsFetching() + useIsMutating() > 0;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!busy) {
      const hide = window.setTimeout(() => setVisible(false), 0);
      return () => window.clearTimeout(hide);
    }
    const show = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(show);
  }, [busy]);

  if (!visible) return null;
  return (
    <div className="ds-progress" role="progressbar" aria-label="Đang tải dữ liệu" aria-busy="true">
      <span className="ds-progress__bar" />
    </div>
  );
}
