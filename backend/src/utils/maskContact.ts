// Che bớt thông tin liên hệ khi phải hiển thị lại cho người dùng (ví dụ nơi nhận mã OTP):
// đủ để họ nhận ra hộp thư hay số điện thoại của mình, nhưng không lộ toàn bộ cho người đứng sau màn hình.

export const maskEmail = (email: string): string => {
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0) return "***";

  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  // Giữ tối đa hai ký tự đầu; phần còn lại luôn che, kể cả khi tên rất ngắn.
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
};

export const maskPhone = (phone: string): string => {
  const digits = phone.replace(/\s+/g, "");
  if (digits.length <= 5) return "*".repeat(digits.length);
  return `${digits.slice(0, 3)}${"*".repeat(digits.length - 5)}${digits.slice(-2)}`;
};

export const maskContact = (value: string): string => (value.includes("@") ? maskEmail(value) : maskPhone(value));
