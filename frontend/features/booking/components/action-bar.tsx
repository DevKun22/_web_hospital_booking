import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

type ActionBarProps = {
  // Dòng tóm tắt ngắn, chỉ hiện trên điện thoại (máy tính đã có phiếu tóm tắt bên phải).
  summary?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  primaryLabel: string;
  onPrimary: () => void;
  loading?: boolean;
};

// Thanh hành động của luồng đặt lịch. Nút chính luôn bấm được; thiếu thông tin thì báo lỗi rõ ở trên,
// không làm mờ nút (nút mờ không cho biết thiếu gì).
export function ActionBar({ summary, onBack, backLabel = "Quay lại", primaryLabel, onPrimary, loading = false }: ActionBarProps) {
  return (
    <div className="booking-action-bar">
      {summary ? <div className="mx-auto mb-2 max-w-xl text-sm lg:hidden">{summary}</div> : null}
      <div className="booking-action-bar__inner">
        {onBack ? (
          <button type="button" onClick={onBack} disabled={loading} className="public-button-secondary inline-flex min-h-12 items-center justify-center rounded-lg px-5 text-sm font-semibold">
            {backLabel}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onPrimary}
          disabled={loading}
          aria-busy={loading}
          className="public-button-primary inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg px-6 text-sm font-semibold lg:flex-none lg:min-w-48"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {primaryLabel}
        </button>
      </div>
    </div>
  );
}
