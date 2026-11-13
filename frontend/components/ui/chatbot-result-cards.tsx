import {
  CalendarDays,
  Clock,
  CreditCard,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { formatChatbotDate } from "@/lib/chatbot-ui";
import type {
  ChatbotResultGroup,
  ChatbotResultItem,
  ChatbotSuggestedAction,
} from "@/lib/types";

import { formatCurrency } from "@/lib/format";
type ChatbotResultCardsProps = {
  groups?: ChatbotResultGroup[];
  disabled?: boolean;
  onAction: (action: ChatbotSuggestedAction) => void;
};

type SlotItem = Extract<ChatbotResultItem, { type: "slot" }>;


const buildAction = (
  item: ChatbotResultItem,
): ChatbotSuggestedAction | null => {
  if (item.type === "department") {
    return {
      type: "VIEW_DEPARTMENT",
      label: item.name,
      payload: {
        departmentId: item.id,
        departmentSlug: item.slug,
      },
    };
  }

  if (item.type === "package") {
    return {
      type: "VIEW_PACKAGE",
      label: item.name,
      payload: {
        packageId: item.id,
        packageSlug: item.slug,
        departmentId: item.departmentId,
      },
    };
  }

  if (item.type === "doctor") {
    return {
      type: "VIEW_DOCTOR",
      label: `${item.title || ""} ${item.fullName}`.trim(),
      payload: {
        doctorId: item.id,
        departmentId: item.departmentId,
      },
    };
  }

  if (item.type === "slot") {
    return {
      type: "VIEW_AVAILABLE_SLOTS",
      label: `${formatChatbotDate(item.date)} ${item.startTime}-${item.endTime}`,
      payload: {
        doctorId: item.doctorId,
        date: item.date,
        timeSlotId: item.id,
      },
    };
  }

  return null;
};

const getActionLabel = (item: ChatbotResultItem) => {
  if (item.type === "department") return "Xem chuyên khoa";
  if (item.type === "package") return "Chọn gói khám";
  return "Chọn bác sĩ";
};

function ResultCard({
  item,
  disabled,
  onAction,
}: {
  item: Exclude<ChatbotResultItem, { type: "slot" }>;
  disabled?: boolean;
  onAction: (action: ChatbotSuggestedAction) => void;
}) {
  const action = buildAction(item);

  return (
    <article className="flex min-h-[112px] flex-col overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface-soft)] p-2">
      {item.type === "department" ? (
        <div className="flex gap-2">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary)]">
            <Stethoscope className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-[var(--foreground)]">
              {item.name}
            </p>
            {item.description ? (
              <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[var(--text-muted)]">
                {item.description}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {item.type === "package" ? (
        <>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-[var(--foreground)]">
              {item.name}
            </p>
            {item.departmentName ? (
              <p className="text-[11px] text-[var(--text-muted)]">
                {item.departmentName}
              </p>
            ) : null}
            {item.summary ? (
              <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[var(--text-muted)]">
                {item.summary}
              </p>
            ) : null}
          </div>
          <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--primary)]">
            <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
            {formatCurrency(item.finalPrice)}
          </div>
        </>
      ) : null}

      {item.type === "doctor" ? (
        <>
          <div className="flex gap-2">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--primary-soft)] text-[var(--primary)]">
              <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-[var(--foreground)]">
                {`${item.title || ""} ${item.fullName}`.trim()}
              </p>
              <p className="truncate text-[11px] text-[var(--text-muted)]">
                {item.departmentName}
              </p>
              {item.specialization ? (
                <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[var(--text-muted)]">
                  {item.specialization}
                </p>
              ) : null}
            </div>
          </div>
          <p className="mt-2 text-[11px] font-semibold text-[var(--primary)]">
            Phí khám {formatCurrency(item.consultationFee)}
          </p>
        </>
      ) : null}

      {action ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAction(action)}
          className="mt-auto w-full rounded-md bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-95 disabled:opacity-60"
        >
          {getActionLabel(item)}
        </button>
      ) : null}
    </article>
  );
}

const groupSlots = (items: SlotItem[]) => {
  const groups = new Map<
    string,
    {
      date: string;
      doctorId: string;
      doctorName?: string;
      departmentName?: string;
      slots: SlotItem[];
    }
  >();

  for (const slot of items) {
    const key = `${slot.date}|${slot.doctorId}`;
    const current = groups.get(key);

    if (current) {
      current.slots.push(slot);
      continue;
    }

    groups.set(key, {
      date: slot.date,
      doctorId: slot.doctorId,
      doctorName: slot.doctorName,
      departmentName: slot.departmentName,
      slots: [slot],
    });
  }

  return Array.from(groups.values());
};

function SlotResults({
  items,
  disabled,
  onAction,
}: {
  items: SlotItem[];
  disabled?: boolean;
  onAction: (action: ChatbotSuggestedAction) => void;
}) {
  return (
    <div className="space-y-2">
      {groupSlots(items).map((group) => (
        <article
          key={`${group.date}-${group.doctorId}`}
          className="rounded-md border border-[var(--border)] bg-[var(--surface-soft)] p-2.5"
        >
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-[var(--foreground)]">
              {group.doctorName || "Bác sĩ phù hợp"}
            </p>
            {group.departmentName ? (
              <p className="truncate text-[11px] text-[var(--text-muted)]">
                {group.departmentName}
              </p>
            ) : null}
            <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-soft)]">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              {formatChatbotDate(group.date)}
            </p>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {group.slots.map((slot) => {
              const action = buildAction(slot);

              return (
                <button
                  key={slot.id}
                  type="button"
                  disabled={disabled || !action}
                  onClick={() => action && onAction(action)}
                  className="inline-flex min-h-9 min-w-0 items-center justify-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-1.5 text-[11px] font-semibold text-[var(--primary)] transition hover:border-[var(--primary)] hover:bg-[var(--primary-soft)] disabled:opacity-60"
                  aria-label={`Chọn khung giờ ${slot.startTime} đến ${slot.endTime}`}
                >
                  <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">
                    {slot.startTime}-{slot.endTime}
                  </span>
                </button>
              );
            })}
          </div>
        </article>
      ))}
    </div>
  );
}

export function ChatbotResultCards({
  groups,
  disabled,
  onAction,
}: ChatbotResultCardsProps) {
  if (!groups?.length) return null;

  return (
    <div className="mt-3 space-y-3">
      {groups.map((group, groupIndex) => {
        if (!group.items.length) return null;

        const slotItems = group.items.filter(
          (item): item is SlotItem => item.type === "slot",
        );
        const regularItems = group.items.filter(
          (
            item,
          ): item is Exclude<ChatbotResultItem, { type: "slot" }> =>
            item.type !== "slot",
        );

        return (
          <section key={`${group.type}-${groupIndex}`} className="space-y-2">
            <div>
              <p className="text-xs font-semibold text-[var(--foreground)]">
                {group.title}
              </p>
              {group.type !== "slots" && group.description ? (
                <p className="mt-0.5 text-[11px] leading-4 text-[var(--text-muted)]">
                  {group.description}
                </p>
              ) : null}
              <p className="mt-0.5 text-[11px] text-[var(--text-soft)]">
                Hiển thị {group.items.length}/{group.total} kết quả
                {group.total > group.items.length
                  ? ". Xem đầy đủ trong phần đặt lịch."
                  : "."}
              </p>
            </div>

            {slotItems.length ? (
              <SlotResults
                items={slotItems}
                disabled={disabled}
                onAction={onAction}
              />
            ) : null}

            {regularItems.length ? (
              <div className="space-y-2">
                {regularItems.map((item) => (
                  <ResultCard
                    key={`${item.type}-${item.id}`}
                    item={item}
                    disabled={disabled}
                    onAction={onAction}
                  />
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}