"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CalendarPlus, Home, UserRound, type LucideIcon } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  // Trả về true khi đường dẫn hiện tại thuộc mục này.
  matches: (pathname: string) => boolean;
};

const ITEMS: NavItem[] = [
  { href: "/", label: "Trang chủ", icon: Home, matches: (path) => path === "/" },
  { href: "/dat-lich", label: "Đặt lịch", icon: CalendarPlus, matches: (path) => path.startsWith("/dat-lich") },
  { href: "/tai-khoan/lich-hen", label: "Lịch của tôi", icon: CalendarDays, matches: (path) => path.startsWith("/tai-khoan/lich-hen") },
  {
    href: "/tai-khoan",
    label: "Tài khoản",
    icon: UserRound,
    matches: (path) => path.startsWith("/tai-khoan") && !path.startsWith("/tai-khoan/lich-hen"),
  },
];

// Điều hướng chính trên điện thoại: bốn đích dùng nhiều nhất, luôn ở tầm ngón cái.
// Chỉ hiện dưới 1024px; trang cần khoảng chừa phía dưới thì thêm lớp public-has-bottom-nav.
export function PublicBottomNav() {
  const pathname = usePathname() || "/";

  return (
    <nav aria-label="Điều hướng chính" className="public-bottom-nav lg:hidden">
      <ul className="mx-auto grid max-w-xl grid-cols-4">
        {ITEMS.map(({ href, label, icon: Icon, matches }) => {
          const active = matches(pathname);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined} className="public-bottom-nav__item" data-active={active}>
                <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
