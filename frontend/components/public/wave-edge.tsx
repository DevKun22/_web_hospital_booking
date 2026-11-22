// Sóng gợn ở mép đáy (hoặc đầu) một khối nền xanh. Chu kỳ sóng (2 * half) phải là ước của 1200 để lớp sóng rộng gấp đôi trôi nửa chiều rộng rồi nối liền không thấy mối.
export function wavePath(half: number, base: number, amp: number) {
  let d = `M0 ${base} Q${half / 2} ${base - amp} ${half} ${base}`;
  for (let x = half * 2; x <= 2400; x += half) d += ` T${x} ${base}`;
  return `${d} V56 H0Z`;
}

const EDGE_A = wavePath(300, 34, 22);
const EDGE_B = wavePath(200, 30, 16);

// Hai lớp sóng thấp ở đáy đầu trang danh mục; màu sóng là màu nền trang bên dưới. Đặt trong vùng có overflow-hidden.
export function WaveEdge({ fill = "var(--public-canvas)" }: { fill?: string }) {
  return (
    <>
      <svg aria-hidden="true" className="hero-wave hero-wave--slim hero-wave--b" viewBox="0 0 2400 56" preserveAspectRatio="none"><path d={EDGE_B} style={{ fill }} /></svg>
      <svg aria-hidden="true" className="hero-wave hero-wave--slim hero-wave--a" viewBox="0 0 2400 56" preserveAspectRatio="none"><path d={EDGE_A} style={{ fill }} /></svg>
    </>
  );
}
