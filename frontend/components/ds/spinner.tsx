import { cn } from "@/lib/utils";

// Vòng quay chờ: dùng chung cho nút, vùng đang tải dữ liệu và tải tệp. Tắt chuyển động khi người dùng chọn giảm chuyển động.
export function DsSpinner({ size = 16, className }: { size?: number; className?: string }) {
  return <span className={cn("ds-spinner", className)} style={{ width: size, height: size }} aria-hidden="true" />;
}

/** Khối "đang tải" cho một vùng nội dung (danh sách, bảng, khung chi tiết): vòng quay cùng chữ cho trình đọc màn hình. */
export function DsLoading({ label = "Đang tải...", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("ds-loading", className)} role="status" aria-live="polite">
      <DsSpinner size={18} />
      <span>{label}</span>
    </div>
  );
}
