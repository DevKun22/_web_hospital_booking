import {
  BellRing,
  Bot,
  Building2,
  CalendarCheck,
  CalendarClock,
  ClipboardList,
  FileText,
  Images,
  LayoutDashboard,
  Package,
  Pill,
  Receipt,
  Settings,
  ScrollText,
  ShieldCheck,
  Star,
  Stethoscope,
  Users,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { can } from "@/lib/permissions";
import type { DashboardRole, DashboardUser } from "@/lib/types";

export type DashboardNavGroupKey =
  | "overview"
  | "operations"
  | "clinical"
  | "pharmacy"
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
  // Hiện khi vai trò có BẤT KỲ quyền nào trong danh sách; rỗng = mọi nhân sự.
  permissions: readonly string[];
  group: DashboardNavGroupKey;
};

export const dashboardNavGroups: ReadonlyArray<{
  key: DashboardNavGroupKey;
  label: string;
}> = [
  { key: "overview", label: "Tổng quan" },
  { key: "operations", label: "Vận hành khám" },
  { key: "clinical", label: "Lâm sàng" },
  { key: "pharmacy", label: "Dược" },
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
    permissions: [],
    group: "overview",
  },
  {
    key: "appointments",
    href: "/dashboard/appointments",
    label: "Lịch hẹn",
    description: "Tiếp nhận và theo dõi lịch khám",
    icon: CalendarCheck,
    permissions: ["appointment.view"],
    group: "operations",
  },
  {
    key: "schedules",
    href: "/dashboard/schedules",
    label: "Lịch bác sĩ",
    description: "Ca làm việc và khung giờ khám",
    icon: CalendarClock,
    permissions: ["schedule.view"],
    group: "operations",
  },
  {
    key: "medical-records",
    href: "/dashboard/medical-records",
    label: "Hồ sơ khám",
    description: "Thông tin khám và kết quả điều trị",
    icon: FileText,
    permissions: ["record.view"],
    group: "clinical",
  },
  {
    key: "prescriptions",
    href: "/dashboard/prescriptions",
    label: "Đơn thuốc",
    description: "Quản lý chỉ định thuốc",
    icon: Pill,
    permissions: ["prescription.view"],
    group: "clinical",
  },
  {
    key: "pharmacy-queue",
    href: "/dashboard/pharmacy",
    label: "Cấp thuốc",
    description: "Đơn chờ cấp theo kho",
    icon: ClipboardList,
    permissions: ["pharmacy.view"],
    group: "pharmacy",
  },
  {
    key: "medicines",
    href: "/dashboard/medicines",
    label: "Kho thuốc",
    description: "Danh mục, tồn kho và sổ kho",
    icon: Warehouse,
    permissions: ["pharmacy.view"],
    group: "pharmacy",
  },
  {
    key: "invoices",
    href: "/dashboard/invoices",
    label: "Hóa đơn",
    description: "Thanh toán và đối soát",
    icon: Receipt,
    permissions: ["invoice.view"],
    group: "finance",
  },
  {
    key: "departments",
    href: "/dashboard/departments",
    label: "Chuyên khoa",
    description: "Danh mục chuyên khoa",
    icon: Building2,
    permissions: ["catalog.manage"],
    group: "catalog",
  },
  {
    key: "doctors",
    href: "/dashboard/doctors",
    label: "Bác sĩ",
    description: "Hồ sơ và phân công bác sĩ",
    icon: Stethoscope,
    permissions: ["catalog.manage"],
    group: "catalog",
  },
  {
    key: "packages",
    href: "/dashboard/packages",
    label: "Gói khám",
    description: "Danh mục dịch vụ và giá",
    icon: Package,
    permissions: ["catalog.manage"],
    group: "catalog",
  },
  {
    key: "notifications",
    href: "/dashboard/notifications",
    label: "Thông báo ứng dụng",
    description: "Chiến dịch và lịch sử gửi",
    icon: BellRing,
    permissions: ["content.manage"],
    group: "engagement",
  },
  {
    key: "reviews",
    href: "/dashboard/reviews",
    label: "Đánh giá",
    description: "Phản hồi về bác sĩ và dịch vụ",
    icon: Star,
    permissions: ["review.view"],
    group: "engagement",
  },
  {
    key: "chatbot",
    href: "/dashboard/chatbot",
    label: "Trợ lý tư vấn",
    description: "Cấu hình trợ lý và nội dung tư vấn",
    icon: Bot,
    permissions: ["chatbot.view"],
    group: "engagement",
  },
  {
    key: "users",
    href: "/dashboard/users",
    label: "Nhân sự",
    description: "Tài khoản và phân quyền",
    icon: Users,
    permissions: ["user.manage"],
    group: "system",
  },
  {
    key: "site-settings",
    href: "/dashboard/site-settings",
    label: "Cấu hình trang người dùng",
    description: "Nhận diện và nội dung công khai",
    icon: Settings,
    permissions: ["settings.view"],
    group: "system",
  },
  {
    key: "uploads",
    href: "/dashboard/uploads",
    label: "Thư viện ảnh",
    description: "Quản lý tài nguyên truyền thông",
    icon: Images,
    permissions: ["content.manage"],
    group: "system",
  },
  {
    key: "permissions",
    href: "/dashboard/permissions",
    label: "Phân quyền",
    description: "Quyền của từng vai trò",
    icon: ShieldCheck,
    permissions: ["rbac.manage"],
    group: "system",
  },
  {
    key: "audit-logs",
    href: "/dashboard/audit-logs",
    label: "Nhật ký truy cập",
    description: "Thao tác nhạy cảm và lượt xem dữ liệu y tế",
    icon: ScrollText,
    permissions: ["audit.view"],
    group: "system",
  },
] as const;

export const dashboardRoleLabels: Record<DashboardRole, string> = {
  ADMIN: "Quản trị viên",
  STAFF: "Nhân viên tiếp nhận",
  DOCTOR: "Bác sĩ",
  PHARMACIST: "Dược sĩ",
};

export function isDashboardItemActive(item: DashboardNavItem, pathname: string) {
  return item.href === "/dashboard"
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function getVisibleDashboardItems(user: DashboardUser) {
  return dashboardNavItems.filter(
    (item) => item.permissions.length === 0 || can(user, ...item.permissions),
  );
}

export function canAccessDashboardPath(user: DashboardUser, pathname: string) {
  return getVisibleDashboardItems(user).some((item) =>
    isDashboardItemActive(item, pathname),
  );
}

export function getDashboardNavItem(pathname: string) {
  return [...dashboardNavItems]
    .sort((left, right) => right.href.length - left.href.length)
    .find((item) => isDashboardItemActive(item, pathname));
}
