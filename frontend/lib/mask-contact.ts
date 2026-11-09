// Máy chủ đã che email/số điện thoại nhận OTP. Hàm này chỉ là lớp phòng thủ thứ hai: nếu vì lý do
// nào đó nhận về giá trị chưa che thì vẫn không hiển thị đầy đủ trên màn hình đăng nhập.
export function maskContactForDisplay(value: string): string {
  const text = value.trim();
  if (!text || text.includes("*")) return text;

  const at = text.lastIndexOf("@");
  if (at > 0) {
    const local = text.slice(0, at);
    const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
    return `${visible}${"*".repeat(Math.max(3, local.length - visible.length))}${text.slice(at)}`;
  }

  if (text.length <= 5) return "*".repeat(text.length);
  return `${text.slice(0, 3)}${"*".repeat(text.length - 5)}${text.slice(-2)}`;
}
