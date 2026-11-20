import { ArrowRight, CalendarCheck, ClipboardList, MessageCircleQuestion, Stethoscope, UserRound } from "lucide-react";
import type { ComponentType } from "react";
import type { ChatbotSuggestedAction } from "@/lib/types";

type IconType = ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;

/** Biểu tượng theo loại gợi ý: nhìn qua biết nút đưa tới việc gì (hỏi thêm, xem lịch, đặt lịch, gói khám...). */
const ICONS: Record<string, IconType> = {
  ASK_QUESTION: MessageCircleQuestion,
  VIEW_DEPARTMENTS: Stethoscope,
  VIEW_DEPARTMENT: Stethoscope,
  VIEW_DOCTOR: UserRound,
  VIEW_DOCTORS: UserRound,
  CHANGE_DOCTOR: UserRound,
  VIEW_PACKAGES: ClipboardList,
  VIEW_PACKAGE: ClipboardList,
  START_BOOKING: CalendarCheck,
  CHANGE_DATE: CalendarCheck,
  LOOKUP_APPOINTMENT: CalendarCheck,
};

type Props = {
  actions: ChatbotSuggestedAction[];
  disabled?: boolean;
  /** `grid`: lưới hai cột ở tin chào; `list`: danh sách dọc dưới câu trả lời. */
  variant?: "grid" | "list";
  title?: string;
  onPick: (action: ChatbotSuggestedAction) => void;
};

// Gợi ý bước tiếp theo nằm ngay dưới câu trả lời mà nó bám theo (không phải hàng cuộn ngang sát ô nhập), mỗi nút đủ lớn để bấm trên điện thoại.
export function FollowUps({ actions, disabled, variant = "list", title, onPick }: Props) {
  if (!actions.length) return null;
  const grid = variant === "grid";
  return (
    <div className="mt-2.5 border-t border-[var(--public-divider)] pt-2">
      {title ? <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--public-muted)]">{title}</p> : null}
      <ul className={grid ? "grid grid-cols-2 gap-1.5" : "flex flex-col gap-1.5"} aria-label={title || "Gợi ý nhanh"}>
        {actions.map((action, index) => {
          const Icon = ICONS[action.type] || ArrowRight;
          return (
            <li key={`${action.type}-${action.label}-${index}`} className="kun-pop" style={{ animationDelay: `${index * 60}ms` }}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPick(action)}
                className={`flex min-h-11 w-full items-center gap-2 rounded-xl border border-[var(--public-border)] bg-white px-3 py-2 text-left text-[13px] font-medium leading-snug text-[var(--public-text-soft)] transition hover:border-[var(--public-primary)] hover:bg-[var(--public-primary-soft)] hover:text-[var(--public-primary-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--public-primary)] disabled:opacity-60 ${grid ? "flex-col justify-center text-center" : ""}`}
              >
                <Icon className="h-4 w-4 shrink-0 text-[var(--public-primary)]" aria-hidden="true" />
                <span className="min-w-0 flex-1">{action.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
