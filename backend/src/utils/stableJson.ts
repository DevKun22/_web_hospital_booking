// Chuỗi JSON không phụ thuộc thứ tự khóa: Postgres JSONB tự sắp lại khóa của đối tượng, nên so sánh giá trị đọc từ cơ sở dữ liệu
// với giá trị vừa gửi lên phải bỏ qua thứ tự khóa.
const normalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, item]) => [key, normalize(item)]),
    );
  }
  return value;
};

export const stableJson = (value: unknown) => JSON.stringify(normalize(value) ?? null);

export const sameJson = (left: unknown, right: unknown) => stableJson(left) === stableJson(right);
