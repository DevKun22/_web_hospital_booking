"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BookOpenText, CalendarDays, CalendarPlus, Home, LayoutGrid, Package, Stethoscope, UserRound, UserRoundCheck, type LucideIcon } from "lucide-react";
import { MobileSheet } from "@/components/public/mobile-sheet";
import { handleSamePageClick } from "@/lib/scroll-top";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  // Trả về true khi đường dẫn hiện tại thuộc mục này.
  matches: (pathname: string) => boolean;
  highlight?: boolean;
};

const SERVICE_LINKS: { href: string; label: string; hint: string; icon: LucideIcon }[] = [
  { href: "/chuyen-khoa", label: "Chuyên khoa", hint: "Chọn khoa theo nhu cầu khám", icon: Stethoscope },
  { href: "/goi-kham", label: "Gói khám", hint: "Hạng mục và chi phí từng gói", icon: Package },
  { href: "/bac-si", label: "Bác sĩ", hint: "Tìm bác sĩ và giờ còn trống", icon: UserRoundCheck },
  { href: "/kien-thuc", label: "Kiến thức", hint: "Bài viết do bác sĩ duyệt", icon: BookOpenText },
];

const isServicePath = (path: string) => SERVICE_LINKS.some((item) => path === item.href || path.startsWith(`${item.href}/`));

const ITEMS: NavItem[] = [
  { href: "/", label: "Trang chủ", icon: Home, matches: (path) => path === "/" },
  // Mục "Dịch vụ" là nút mở tấm trượt (xử lý riêng bên dưới), giữ ở đây để thứ tự và kiểu dáng thống nhất.
  { href: "#dich-vu", label: "Dịch vụ", icon: LayoutGrid, matches: isServicePath },
  { href: "/dat-lich", label: "Đặt lịch", icon: CalendarPlus, matches: (path) => path.startsWith("/dat-lich"), highlight: true },
  { href: "/tai-khoan/lich-hen", label: "Lịch của tôi", icon: CalendarDays, matches: (path) => path.startsWith("/tai-khoan/lich-hen") },
  {
    href: "/tai-khoan",
    label: "Tài khoản",
    icon: UserRound,
    matches: (path) => path.startsWith("/tai-khoan") && !path.startsWith("/tai-khoan/lich-hen"),
  },
];

// Điều hướng chính trên điện thoại: năm đích dùng nhiều nhất, luôn ở tầm ngón cái. Đặt lịch là nút giữa nổi bật; Dịch vụ mở tấm trượt bốn danh mục.
// Bấm lại mục đang chọn (đúng trang đó) thì cuộn lên đầu. Chỉ hiện dưới 1024px; trang cần khoảng chừa phía dưới thì thêm lớp public-has-bottom-nav.
export function PublicBottomNav() {
  const pathname = usePathname() || "/";
  const [servicesOpen, setServicesOpen] = useState(false);

  return (
    <>
      <nav aria-label="Điều hướng chính" className="public-bottom-nav lg:hidden">
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {ITEMS.map(({ href, label, icon: Icon, matches, highlight }) => {
            const active = matches(pathname);
            const content = (
              <>
                {highlight ? (
                  <span className="-mt-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--public-solid)] text-white shadow-md ring-4 ring-[var(--public-surface)]">
                    <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                  </span>
                ) : (
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
                )}
                <span>{label}</span>
              </>
            );
            return (
              <li key={href}>
                {href === "#dich-vu" ? (
                  <button type="button" onClick={() => setServicesOpen(true)} aria-haspopup="dialog" aria-expanded={servicesOpen} data-active={active} className="public-bottom-nav__item w-full">
                    {content}
                  </button>
                ) : (
                  <Link href={href} onClick={(event) => handleSamePageClick(event, pathname, href)} aria-current={active ? "page" : undefined} className="public-bottom-nav__item" data-active={active && !highlight}>
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <MobileSheet open={servicesOpen} onClose={() => setServicesOpen(false)} title="Dịch vụ">
        <ul className="mt-2 space-y-1">
          {SERVICE_LINKS.map(({ href, label, hint, icon: Icon }) => {
            const current = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setServicesOpen(false)}
                  aria-current={current ? "page" : undefined}
                  className={`flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 ${current ? "bg-[var(--public-primary-soft)]" : "hover:bg-[var(--public-surface-muted)]"}`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--public-primary-soft)] text-[var(--public-primary)]" aria-hidden="true">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className={`block text-base ${current ? "font-semibold text-[var(--public-primary-dark)]" : "font-medium"}`}>{label}</span>
                    <span className="block truncate text-sm text-[var(--public-muted)]">{hint}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </MobileSheet>
    </>
  );
}
