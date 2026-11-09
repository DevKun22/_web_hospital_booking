import { cn } from "@/lib/utils";

export type DsTone = "neutral" | "good" | "warn" | "bad" | "info";

// Trạng thái luôn có chữ (không chỉ màu), kèm chấm màu cùng tông để quét nhanh.
export function DsStatusPill({ tone = "neutral", children }: { tone?: DsTone; children: React.ReactNode }) {
  return <span className={cn("ds-pill", tone !== "neutral" && `ds-pill--${tone}`)}>{children}</span>;
}
