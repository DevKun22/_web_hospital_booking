// Màu thẻ khi chưa có ảnh: chọn theo tên chuyên khoa để mỗi khoa luôn cùng một màu ở danh mục chuyên khoa và gói khám.
const TONES = [["#2f7fc4", "#1d5a96"], ["#2aa198", "#177d74"], ["#d98a3d", "#b36a22"], ["#6c63c7", "#4a43a0"]] as const;

export const toneOf = (name: string) => TONES[(name.charCodeAt(0) + name.length) % TONES.length];

export const toneGradient = (name: string) => {
  const [from, to] = toneOf(name);
  return `linear-gradient(135deg, ${from}, ${to})`;
};
