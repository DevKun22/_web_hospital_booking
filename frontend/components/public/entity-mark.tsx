// Từ chung đứng đầu tên khoa, gói ("Khoa", "Gói khám"...) không mang nghĩa nên bỏ khi lấy chữ viết tắt.
const GENERIC_WORDS = new Set(["khoa", "chuyên", "gói", "khám", "dịch", "vụ"]);

/** Hai chữ đầu của tên sau khi bỏ từ chung: "Khoa Tim mạch" → "TM", "Gói khám tổng quát" → "TQ". Khớp với app mobile. */
export function entityInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const firstMeaningful = words.findIndex((word) => !GENERIC_WORDS.has(word.toLocaleLowerCase("vi")));
  const source = firstMeaningful === -1 ? words : words.slice(firstMeaningful);
  if (!source.length) return "?";
  return source
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join("")
    .toLocaleUpperCase("vi");
}

/**
 * Phần ảnh của thẻ khoa, gói khám khi quản trị chưa tải ảnh: nền xanh nhạt của thương hiệu, chữ viết tắt căn giữa.
 * Mọi khoa, gói dùng chung một tông, nên thêm khoa mới không cần chọn màu hay biểu tượng.
 */
export function EntityMark({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-full w-full select-none items-center justify-center bg-[var(--public-primary-soft)] font-semibold tracking-wide text-[var(--public-primary)] ${className}`}
    >
      {entityInitials(name)}
    </span>
  );
}
