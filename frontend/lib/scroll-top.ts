import type { MouseEvent } from "react";

// Cuộn mượt lên đầu trang (tức thì khi người dùng chọn giảm chuyển động) và bỏ phần neo (#mục) khỏi địa chỉ.
export function scrollToTop() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  if (window.location.hash) window.history.replaceState(null, "", window.location.pathname + window.location.search);
}

// Bấm liên kết trỏ đúng trang đang xem (logo, Trang chủ, tab đang chọn ở thanh dưới): Next coi đó là điều hướng không đổi nên không cuộn gì cả.
// Chặn điều hướng và cuộn lên đầu; trả true khi đã xử lý. Bấm kèm phím Ctrl/Cmd/Shift hoặc chuột giữa vẫn để trình duyệt mở tab mới.
export function handleSamePageClick(event: MouseEvent, pathname: string, href: string) {
  if (pathname !== href || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  event.preventDefault();
  scrollToTop();
  return true;
}
