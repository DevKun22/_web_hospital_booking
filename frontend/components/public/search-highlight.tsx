const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u0111/g, "d");

const buildNormalizedIndex = (value: string) => {
  const chars = Array.from(value);
  let normalized = "";
  const map: number[] = [];

  chars.forEach((char, index) => {
    const normalizedChar = normalizeText(char);
    normalized += normalizedChar;
    for (let i = 0; i < normalizedChar.length; i += 1) {
      map.push(index);
    }
  });

  return { chars, normalized, map };
};

export function HighlightText({
  text,
  query,
  className = "rounded bg-[var(--public-warning-soft)] px-0.5 font-semibold text-[var(--public-warning)]",
}: {
  text: string;
  query: string;
  className?: string;
}) {
  const normalizedQuery = normalizeText(query.trim());
  if (!text || normalizedQuery.length < 2) return text;

  const { chars, normalized, map } = buildNormalizedIndex(text);
  const segments: Array<{ text: string; matched: boolean }> = [];
  let normalizedCursor = 0;
  let originalCursor = 0;

  while (normalizedCursor < normalized.length) {
    const foundAt = normalized.indexOf(normalizedQuery, normalizedCursor);
    if (foundAt === -1) break;

    const originalStart = map[foundAt] ?? originalCursor;
    const originalEnd =
      (map[foundAt + normalizedQuery.length - 1] ?? originalStart) + 1;

    if (originalStart > originalCursor) {
      segments.push({
        text: chars.slice(originalCursor, originalStart).join(""),
        matched: false,
      });
    }

    segments.push({
      text: chars.slice(originalStart, originalEnd).join(""),
      matched: true,
    });

    originalCursor = originalEnd;
    normalizedCursor = foundAt + normalizedQuery.length;
  }

  if (!segments.length) return text;

  if (originalCursor < chars.length) {
    segments.push({
      text: chars.slice(originalCursor).join(""),
      matched: false,
    });
  }

  return (
    <>
      {segments.map((segment, index) =>
        segment.matched ? (
          <mark key={`${segment.text}-${index}`} className={className}>
            {segment.text}
          </mark>
        ) : (
          <span key={`${segment.text}-${index}`}>{segment.text}</span>
        ),
      )}
    </>
  );
}
