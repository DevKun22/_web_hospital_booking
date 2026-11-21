"use client";

// Mã hồ sơ người thân rỗng nghĩa là của bản thân (lịch cũ chưa gắn hồ sơ cũng vậy).
export type PersonOption = readonly [key: string, name: string];

// Gom những người xuất hiện trong danh sách; "Bản thân" luôn đứng đầu.
export function collectPeople<T>(items: T[], keyOf: (item: T) => string, nameOf: (item: T) => string): PersonOption[] {
  const map = new Map<string, string>();
  for (const item of items) if (!map.has(keyOf(item))) map.set(keyOf(item), nameOf(item));
  return [...map.entries()].sort(([a], [b]) => Number(a !== "") - Number(b !== ""));
}

// Thanh lọc theo người khám; chỉ hiện khi có từ hai người trở lên. active = null là tất cả.
export function PersonFilter({ people, active, onChange }: { people: PersonOption[]; active: string | null; onChange: (key: string | null) => void }) {
  if (people.length < 2) return null;
  const options: PersonOption[] = [["__all", "Tất cả"], ...people.map(([key, name]) => [key, key === "" ? "Bản thân" : name] as const)];
  return (
    <div role="group" aria-label="Lọc theo người khám" className="flex flex-wrap gap-2">
      {options.map(([key, label]) => {
        const selected = (key === "__all" ? null : key) === active;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(key === "__all" ? null : key)}
            className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors ${selected ? "border-[var(--public-primary)] bg-[var(--public-primary-soft)] text-[var(--public-primary-dark)]" : "border-[var(--public-border)] text-[var(--public-text-soft)] hover:bg-[var(--public-surface-muted)]"}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
