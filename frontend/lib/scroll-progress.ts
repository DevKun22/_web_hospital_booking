// Tiến độ cuộn qua một vùng nội dung: 0 khi mép trên vùng chạm đỉnh màn hình, 1 khi mép dưới vùng chạm đáy màn hình.
export function scrollProgress(scrollY: number, top: number, height: number, viewport: number) {
  const range = height - viewport;
  if (!(range > 0)) return 0;
  return Math.min(1, Math.max(0, (scrollY - top) / range));
}
