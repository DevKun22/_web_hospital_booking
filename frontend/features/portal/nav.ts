import { Bell, CalendarDays, FileHeart, Home, ReceiptText, ShieldCheck, UserRound, type LucideIcon } from "lucide-react";

export type PortalNavItem = {
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  showUnread?: boolean;
};

export type PortalNavGroup = { title: string; items: PortalNavItem[] };

// Cấu trúc điều hướng cổng người khám, dùng chung cho thanh bên (máy tính) và danh sách ở trang Tài khoản (điện thoại).
export const PORTAL_HOME: PortalNavItem = { href: "/tai-khoan", label: "Tổng quan", hint: "Lịch sắp tới và việc cần làm", icon: Home };

export const PORTAL_GROUPS: PortalNavGroup[] = [
  {
    title: "Khám bệnh",
    items: [
      { href: "/tai-khoan/lich-hen", label: "Lịch hẹn", hint: "Sắp tới, đã khám, đã hủy", icon: CalendarDays },
      { href: "/tai-khoan/ho-so-suc-khoe", label: "Kết quả và đơn thuốc", hint: "Kết quả khám, xét nghiệm, đơn thuốc", icon: FileHeart },
      { href: "/tai-khoan/hoa-don", label: "Hóa đơn", hint: "Thanh toán và lịch sử", icon: ReceiptText },
    ],
  },
  {
    title: "Tài khoản",
    items: [
      { href: "/tai-khoan/ho-so", label: "Hồ sơ và người thân", hint: "Thông tin cá nhân, BHYT, người thân", icon: UserRound },
      { href: "/tai-khoan/thong-bao", label: "Thông báo", hint: "Cập nhật về lịch hẹn và kết quả", icon: Bell, showUnread: true },
      { href: "/tai-khoan/bao-mat", label: "Bảo mật", hint: "Thiết bị đang đăng nhập", icon: ShieldCheck },
    ],
  },
];

export const isPortalPathActive = (pathname: string, href: string) =>
  href === PORTAL_HOME.href ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
