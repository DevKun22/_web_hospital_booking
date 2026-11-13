export function DoctorMetric({
  label,
  value,
  note,
  positive = false,
}: {
  label: string;
  value?: number;
  note: string;
  positive?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-[var(--public-border)] border-t-2 bg-white p-3 shadow-sm ${positive ? "border-t-[var(--public-success)]" : "border-t-[var(--public-primary)]"}`}
    >
      <dt className="text-xs font-semibold text-[var(--public-muted)]">
        {label}
      </dt>
      <dd
        className={`mt-1 text-2xl font-bold tabular-nums ${positive ? "text-[var(--public-success)]" : "text-[var(--public-primary)]"}`}
      >
        {value ?? "—"}
      </dd>
      <dd className="mt-1 text-[10px] leading-4 text-[var(--public-muted)]">
        {note}
      </dd>
    </div>
  );
}
