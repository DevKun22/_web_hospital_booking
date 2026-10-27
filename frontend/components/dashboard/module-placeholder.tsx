type ModulePlaceholderProps = {
  title: string;
  group: string;
  description: string;
  endpoints: string[];
};

export function ModulePlaceholder({
  title,
  group,
  description,
  endpoints,
}: ModulePlaceholderProps) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-sm)]">
      <p className="text-sm font-medium text-[var(--text-muted)]">{group}</p>
      <h2 className="mt-1 text-2xl font-semibold">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-muted)]">
        {description}
      </p>
      <div className="mt-5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
        <p className="text-sm font-semibold text-[var(--foreground)]">
          API sẽ nối tiếp theo
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {endpoints.map((endpoint) => (
            <code
              key={endpoint}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--text-soft)]"
            >
              {endpoint}
            </code>
          ))}
        </div>
      </div>
    </section>
  );
}
