import {
  BellRing,
  Bot,
  Building2,
  CalendarCheck,
  CalendarClock,
  FileText,
  Images,
  LayoutDashboard,
  MessageSquareText,
  Package,
  Pill,
  Receipt,
  Settings,
  Star,
  Stethoscope,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { DashboardRole } from "@/lib/types";

export type DashboardNavGroupKey =
  | "overview"
  | "operations"
  | "clinical"
  | "finance"
  | "catalog"
  | "engagement"
  | "system";

export type DashboardNavItem = {
  key: string;
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  roles: readonly DashboardRole[];
  group: DashboardNavGroupKey;
};

export const dashboardNavGroups: ReadonlyArray<{
  key: DashboardNavGroupKey;
  label: string;
}> = [
  { key: "overview", label: "Tổng quan" },
  { key: "operations", label: "Vận hành khám" },
  { key: "clinical", label: "Lâm sàng" },
  { key: "finance", label: "Tài chính" },
  { key: "catalog", label: "Danh mục" },
  { key: "engagement", label: "Tương tác" },
  { key: "system", label: "Hệ thống" },
];

export const dashboardNavItems: readonly DashboardNavItem[] = [
  {
    key: "overview",
    href: "/dashboard",
    label: "Tổng quan",
    description: "Tình hình vận hành trong ngày",
    icon: LayoutDashboard,
    roles: ["ADMIN", "STAFF", "DOCTOR"],
    group: "overview",
  },
  {
    key: "appointments",
    href: "/dashboard/appointments",
    label: "Lịch hẹn",
    description: "Tiếp nhận và theo dõi lịch khám",
    icon: CalendarCheck,
    roles: ["ADMIN", "STAFF", "DOCTOR"],
    group: "operations",
  },
  {
    key: "schedules",
    href: "/dashboard/schedules",
    label: "Lịch bác sĩ",
    description: "Ca làm việc và khung giờ khám",
    icon: CalendarClock,
    roles: ["ADMIN", "STAFF", "DOCTOR"],
    group: "operations",
  },
  {
    key: "consultation-requests",
    href: "/dashboard/consultation-requests",
    label: "Yêu cầu tư vấn",
    description: "Theo dõi yêu cầu cần liên hệ",
    icon: MessageSquareText,
    roles: ["ADMIN", "STAFF"],
    group: "operations",
  },
  {
    key: "medical-records",
    href: "/dashboard/medical-records",
    label: "Hồ sơ khám",
    description: "Thông tin khám và kết quả điều trị",
    icon: FileText,
    roles: ["ADMIN", "STAFF", "DOCTOR"],
    group: "clinical",
  },
  {
    key: "prescriptions",
    href: "/dashboard/prescriptions",
    label: "Đơn thuốc",
    description: "Quản lý chỉ định thuốc",
    icon: Pill,
    roles: ["ADMIN", "STAFF", "DOCTOR"],
    group: "clinical",
  },
  {
    key: "invoices",
    href: "/dashboard/invoices",
    label: "Hóa đơn",
    description: "Thanh toán và đối soát",
    icon: Receipt,
    roles: ["ADMIN", "STAFF"],
    group: "finance",
  },
  {
    key: "departments",
    href: "/dashboard/departments",
    label: "Chuyên khoa",
    description: "Danh mục chuyên khoa",
    icon: Building2,
    roles: ["ADMIN", "STAFF"],
    group: "catalog",
  },
  {
    key: "doctors",
    href: "/dashboard/doctors",
    label: "Bác sĩ",
    description: "Hồ sơ và phân công bác sĩ",
    icon: Stethoscope,
    roles: ["ADMIN", "STAFF"],
    group: "catalog",
  },
  {
    key: "packages",
    href: "/dashboard/packages",
    label: "Gói khám",
    description: "Danh mục dịch vụ và giá",
    icon: Package,
    roles: ["ADMIN", "STAFF"],
    group: "catalog",
  },
  {
    key: "notifications",
    href: "/dashboard/notifications",
    label: "Thông báo ứng dụng",
    description: "Chiến dịch và lịch sử gửi",
    icon: BellRing,
    roles: ["ADMIN", "STAFF"],
    group: "engagement",
  },
  {
    key: "reviews",
    href: "/dashboard/reviews",
    label: "Đánh giá",
    description: "Phản hồi về bác sĩ và dịch vụ",
    icon: Star,
    roles: ["ADMIN", "STAFF", "DOCTOR"],
    group: "engagement",
  },
  {
    key: "chatbot",
    href: "/dashboard/chatbot",
    label: "Trợ lý tư vấn",
    description: "Cấu hình trợ lý và nội dung tư vấn",
    icon: Bot,
    roles: ["ADMIN", "STAFF"],
    group: "engagement",
  },
  {
    key: "users",
    href: "/dashboard/users",
    label: "Nhân sự",
    description: "Tài khoản và phân quyền",
    icon: Users,
    roles: ["ADMIN"],
    group: "system",
  },
  {
    key: "site-settings",
    href: "/dashboard/site-settings",
    label: "Cấu hình trang người dùng",
    description: "Nhận diện và nội dung công khai",
    icon: Settings,
    roles: ["ADMIN", "STAFF"],
    group: "system",
  },
  {
    key: "uploads",
    href: "/dashboard/uploads",
    label: "Thư viện ảnh",
    description: "Quản lý tài nguyên truyền thông",
    icon: Images,
    roles: ["ADMIN", "STAFF"],
    group: "system",
  },
] as const;

export const dashboardRoleLabels: Record<DashboardRole, string> = {
  ADMIN: "Quản trị viên",
  STAFF: "Nhân viên tiếp nhận",
  DOCTOR: "Bác sĩ",
};

export function isDashboardItemActive(item: DashboardNavItem, pathname: string) {
  return item.href === "/dashboard"
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function getVisibleDashboardItems(role: DashboardRole) {
  return dashboardNavItems.filter((item) => item.roles.includes(role));
}

export function canAccessDashboardPath(role: DashboardRole, pathname: string) {
  return getVisibleDashboardItems(role).some((item) =>
    isDashboardItemActive(item, pathname),
  );
}

export function getDashboardNavItem(pathname: string) {
  return [...dashboardNavItems]
    .sort((left, right) => right.href.length - left.href.length)
    .find((item) => isDashboardItemActive(item, pathname));
}
