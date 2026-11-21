// Đường sóng nối hai mục trang chủ: phần trên mang màu mục trước, phần dưới mang màu mục sau. Chỉ để trang trí nên ẩn với trình đọc màn hình.
const PATHS = [
  "M0 22 Q150 2 300 20 T600 18 T900 22 T1200 16 V40 H0Z",
  "M0 16 Q200 38 420 18 T820 20 T1200 14 V40 H0Z",
  "M0 20 Q180 0 380 18 T800 24 T1200 18 V40 H0Z",
];

export function WaveDivider({ from, to, variant = 0 }: { from: string; to: string; variant?: number }) {
  return (
    <div aria-hidden="true" className="-mb-px leading-[0]" style={{ background: from }}>
      <svg viewBox="0 0 1200 40" preserveAspectRatio="none" className="block h-6 w-full sm:h-9 lg:h-11">
        <path d={PATHS[variant % PATHS.length]} style={{ fill: to }} />
      </svg>
    </div>
  );
}
