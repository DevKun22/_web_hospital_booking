// Kiểu chip và ô tìm dùng chung cho thanh lọc phẳng; để ở tệp không phải thành phần máy khách để trang máy chủ (danh sách kiến thức) dùng được.
export const chipClass = (selected: boolean) =>
  `inline-flex min-h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--public-primary)] ${
    selected
      ? "border-[var(--public-primary)] bg-[var(--public-primary-soft)] text-[var(--public-primary-dark)]"
      : "border-[var(--public-border)] bg-[var(--public-surface)] text-[var(--public-text-soft)] hover:border-[var(--public-primary)]"
  }`;

export const FLAT_SEARCH_INPUT_CLASS = "ui-field min-h-11 w-full rounded-full pl-4 pr-12 text-base sm:text-sm";
export const FLAT_SEARCH_BUTTON_CLASS =
  "absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[var(--public-primary)] hover:bg-[var(--public-primary-soft)] focus-visible:outline-2 focus-visible:outline-[var(--public-primary)]";
