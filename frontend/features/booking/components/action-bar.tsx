import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

type ActionBarProps = {
  // Dòng tóm tắt ngắn, chỉ hiện trên điện thoại (máy tính đã có phiếu tóm tắt bên phải).
  summary?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  primaryLabel: string;
  onPrimary: () => void;
  loading?: boolean;
  // Mốc thời gian (ms) hết bị giới hạn tần suất: nút chính bị khóa và hiện đếm ngược cho tới mốc này.
  cooldownUntil?: number;
};

// Thanh hành động của luồng đặt lịch. Nút chính luôn bấm được; thiếu thông tin thì báo lỗi rõ ở trên,
// không làm mờ nút (nút mờ không cho biết thiếu gì).
const formatCountdown = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

// Số giây còn lại tới mốc `until` (0 khi đã qua hoặc không đặt); chỉ chạy bộ đếm khi còn đang đếm.
const useSecondsUntil = (until: number) => {
  const remaining = () => (until > 0 ? Math.max(Math.ceil((until - Date.now()) / 1000), 0) : 0);
  const [seconds, setSeconds] = useState(remaining);
  useEffect(() => {
    if (until <= 0) return;
    // Cập nhật trong hàm gọi lại (không gọi setState trực tiếp trong effect): lần đầu ngay sau khi vẽ, sau đó mỗi giây.
    const tick = () => {
      const next = remaining();
      setSeconds(next);
      if (next === 0) window.clearInterval(timer);
    };
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [until]);
  return seconds;
};

export function ActionBar({ summary, onBack, backLabel = "Quay lại", primaryLabel, onPrimary, loading = false, cooldownUntil = 0 }: ActionBarProps) {
  const coolingDown = useSecondsUntil(cooldownUntil);
  // Máy tính: thanh dính đáy màn hình khi phần cuối bước còn nằm dưới tầm nhìn (có viền và bóng); cuộn tới cuối thì nằm yên trong luồng.
  // Mốc nhận biết là một điểm đặt ngay trước thanh: còn khuất dưới màn hình tức là thanh đang nổi.
  const anchor = useRef<HTMLDivElement>(null);
  const [floating, setFloating] = useState(false);
  useEffect(() => {
    const node = anchor.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setFloating(!entry.isIntersecting && entry.boundingClientRect.top > 0));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <>
    <div ref={anchor} aria-hidden="true" className="hidden h-px lg:block" />
    <div className="booking-action-bar" data-floating={floating}>
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
          disabled={loading || coolingDown > 0}
          aria-busy={loading}
          className="public-button-primary inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg px-6 text-sm font-semibold lg:flex-none lg:min-w-48"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {coolingDown > 0 ? `Thử lại sau ${formatCountdown(coolingDown)}` : primaryLabel}
        </button>
      </div>
    </div>
    </>
  );
}
