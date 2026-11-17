import type { ChatbotSuggestedAction } from "@/lib/types";

// Gợi ý trả lời nhanh: một hàng cuộn ngang ngay trên ô nhập, tối đa vài nút theo ngữ cảnh. Mỗi nút hiện lần lượt cho đỡ rối mắt.
export function QuickReplies({
  actions,
  disabled,
  onPick,
}: {
  actions: ChatbotSuggestedAction[];
  disabled?: boolean;
  onPick: (action: ChatbotSuggestedAction) => void;
}) {
  if (!actions.length) return null;
  return (
    <ul className="kun-scroll-x flex gap-2 overflow-x-auto px-3 pb-2" aria-label="Gợi ý nhanh">
      {actions.map((action, index) => (
        <li key={`${action.type}-${action.label}-${index}`} className="kun-pop shrink-0" style={{ animationDelay: `${index * 60}ms` }}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onPick(action)}
            className="min-h-9 whitespace-nowrap rounded-full border border-[var(--public-border)] bg-white px-3 text-xs font-medium text-[var(--public-text-soft)] transition hover:border-[var(--public-primary)] hover:bg-[var(--public-primary-soft)] hover:text-[var(--public-primary-dark)] disabled:opacity-60"
          >
            {action.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
