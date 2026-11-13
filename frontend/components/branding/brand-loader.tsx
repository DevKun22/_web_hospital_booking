import { BrandLogo } from "@/components/branding/brand-logo";
import { cn } from "@/lib/utils";

export type BrandLoaderProps = {
  size?: "sm" | "md" | "lg";
  // Nội dung trạng thái, ví dụ "Đang tải lịch khám...".
  label?: string;
  fullScreen?: boolean;
  className?: string;
};

const BOX = { sm: "h-12 w-12", md: "h-16 w-16", lg: "h-24 w-24" } as const;

// Dùng cho tải toàn trang hiếm gặp. Tải danh sách nên dùng skeleton, gửi biểu mẫu dùng spinner
// trong nút. Không ép thời gian chờ tối thiểu.
export function BrandLoader({ size = "md", label = "Đang tải...", fullScreen = false, className }: BrandLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center",
        fullScreen ? "fixed inset-0 z-[100] bg-[var(--public-canvas,#f2fafc)]" : "py-10",
        className,
      )}
    >
      <span className={cn("brand-loader relative inline-flex items-center justify-center", BOX[size])}>
        <span className="brand-loader__ring" aria-hidden="true" />
        <BrandLogo variant="icon" size={size} decorative className="brand-loader__logo" />
      </span>
      <span className="text-sm font-semibold text-[var(--public-text-soft,#4f6b7d)]">{label}</span>
    </div>
  );
}
