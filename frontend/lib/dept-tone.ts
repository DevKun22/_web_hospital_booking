// Màu thẻ khi chưa có ảnh: chọn theo tên chuyên khoa để mỗi khoa luôn cùng một màu ở danh mục chuyên khoa và gói khám.
const TONES = [
  ["var(--tone-blue)", "var(--tone-blue-deep)"],
  ["var(--tone-teal)", "var(--tone-teal-deep)"],
  ["var(--tone-amber)", "var(--tone-amber-deep)"],
  ["var(--tone-violet)", "var(--tone-violet-deep)"],
] as const;

export const toneOf = (name: string) => TONES[(name.charCodeAt(0) + name.length) % TONES.length];

export const toneGradient = (name: string) => {
  const [from, to] = toneOf(name);
  return `linear-gradient(135deg, ${from}, ${to})`;
};
