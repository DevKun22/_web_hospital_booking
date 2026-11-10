import type { Role } from "../../generated/prisma/enums.js";

// Vai trò dùng dashboard. PATIENT không có quyền dashboard.
export const STAFF_ROLES = ["ADMIN", "STAFF", "DOCTOR", "PHARMACIST"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const isStaffRole = (role: Role | string | undefined): role is StaffRole =>
  STAFF_ROLES.includes(role as StaffRole);

type PermissionDefinition = {
  group: string;
  label: string;
  // Vai trò ĐƯỢC PHÉP nhận quyền này. Quản trị không thể cấp ngoài tập này,
  // nên "quản trị sửa đơn thuốc" hay "nhân viên đọc bệnh án" không thể xảy ra
  // dù ma trận bị chỉnh sai.
  eligibleRoles: readonly StaffRole[];
  // Vai trò luôn có quyền (không thể gỡ), tránh khóa chính mình khỏi hệ thống.
  fixedRoles: readonly StaffRole[];
  // Giá trị khi chưa có cấu hình trong SiteSetting `rbac.matrix`.
  defaultRoles: readonly StaffRole[];
};

const A = "ADMIN" as const;
const S = "STAFF" as const;
const D = "DOCTOR" as const;
const P = "PHARMACIST" as const;

export const PERMISSIONS = {
  // Lịch hẹn
  "appointment.view": { group: "Lịch hẹn", label: "Xem lịch hẹn", eligibleRoles: [A, S, D], fixedRoles: [], defaultRoles: [A, S, D] },
  "appointment.front_desk": { group: "Lịch hẹn", label: "Tiếp đón: xác nhận, check-in, vắng mặt, đổi lịch, sửa thông tin", eligibleRoles: [A, S], fixedRoles: [], defaultRoles: [A, S] },
  "appointment.cancel": { group: "Lịch hẹn", label: "Hủy lịch hẹn", eligibleRoles: [A, S, D], fixedRoles: [], defaultRoles: [A, S, D] },
  "appointment.exam_start": { group: "Lịch hẹn", label: "Bắt đầu buổi khám", eligibleRoles: [S, D], fixedRoles: [D], defaultRoles: [S, D] },
  // Kết thúc buổi khám đánh dấu lịch COMPLETED và mở khâu hóa đơn, nên mặc định chỉ bác sĩ.
  // Nhân viên chỉ làm thay khi quản trị chủ động cấp quyền này.
  "appointment.exam_finish": { group: "Lịch hẹn", label: "Kết thúc buổi khám (hoàn tất lịch, mở khâu hóa đơn)", eligibleRoles: [S, D], fixedRoles: [D], defaultRoles: [D] },

  // Bệnh án và đơn thuốc: dữ liệu y tế, chỉ vai trò lâm sàng. Quản trị đủ điều kiện để được
  // cấp quyền xem khi cần (ví dụ xử lý khiếu nại) nhưng mặc định không có, và mỗi lần xem
  // chi tiết đều được ghi vào nhật ký truy cập.
  "record.view": { group: "Hồ sơ bệnh án", label: "Xem hồ sơ bệnh án", eligibleRoles: [A, D], fixedRoles: [D], defaultRoles: [D] },
  "record.edit": { group: "Hồ sơ bệnh án", label: "Ghi, sửa, công bố bệnh án và kết quả xét nghiệm", eligibleRoles: [D], fixedRoles: [D], defaultRoles: [D] },
  "record.archive": { group: "Hồ sơ bệnh án", label: "Lưu trữ bệnh án", eligibleRoles: [A, D], fixedRoles: [], defaultRoles: [D] },
  "prescription.view": { group: "Đơn thuốc", label: "Xem đơn thuốc", eligibleRoles: [A, D, P], fixedRoles: [D, P], defaultRoles: [D, P] },
  "prescription.write": { group: "Đơn thuốc", label: "Kê, sửa, phát hành, hủy đơn thuốc", eligibleRoles: [D], fixedRoles: [D], defaultRoles: [D] },

  // Hóa đơn: thu tiền (nhân viên) khác hoàn tiền (quản trị)
  "invoice.view": { group: "Hóa đơn", label: "Xem hóa đơn", eligibleRoles: [A, S], fixedRoles: [], defaultRoles: [A, S] },
  "invoice.collect": { group: "Hóa đơn", label: "Ghi nhận thu tiền", eligibleRoles: [A, S], fixedRoles: [], defaultRoles: [A, S] },
  "invoice.manage": { group: "Hóa đơn", label: "Tạo, sửa, hủy hóa đơn", eligibleRoles: [A, S], fixedRoles: [], defaultRoles: [A, S] },
  "invoice.refund": { group: "Hóa đơn", label: "Hoàn tiền", eligibleRoles: [A], fixedRoles: [A], defaultRoles: [A] },

  // Danh mục
  "catalog.view": { group: "Danh mục", label: "Xem khoa, bác sĩ, gói khám", eligibleRoles: [A, S, D], fixedRoles: [], defaultRoles: [A, S, D] },
  "catalog.manage": { group: "Danh mục", label: "Tạo, sửa khoa, bác sĩ, gói khám", eligibleRoles: [A, S], fixedRoles: [], defaultRoles: [A, S] },
  "catalog.delete": { group: "Danh mục", label: "Xóa khoa, bác sĩ, gói khám", eligibleRoles: [A], fixedRoles: [A], defaultRoles: [A] },

  // Lịch làm việc
  "schedule.view": { group: "Lịch làm việc", label: "Xem lịch làm việc và khung giờ", eligibleRoles: [A, S, D], fixedRoles: [], defaultRoles: [A, S, D] },
  "schedule.manage": { group: "Lịch làm việc", label: "Tạo, sửa lịch làm việc và khung giờ", eligibleRoles: [A, S], fixedRoles: [], defaultRoles: [A, S] },
  "schedule.lock": { group: "Lịch làm việc", label: "Khóa, mở khóa khung giờ", eligibleRoles: [A, S, D], fixedRoles: [], defaultRoles: [A, S, D] },
  "schedule.reconcile": { group: "Lịch làm việc", label: "Đối soát khung giờ", eligibleRoles: [A], fixedRoles: [A], defaultRoles: [A] },
  "schedule.request": { group: "Lịch làm việc", label: "Bác sĩ gửi và hủy yêu cầu đổi lịch", eligibleRoles: [D], fixedRoles: [D], defaultRoles: [D] },
  "schedule.review": { group: "Lịch làm việc", label: "Duyệt yêu cầu đổi lịch", eligibleRoles: [A, S], fixedRoles: [], defaultRoles: [A, S] },

  // Nội dung công khai và đánh giá
  "content.manage": { group: "Nội dung", label: "Quản lý banner, FAQ, thông báo, ảnh", eligibleRoles: [A, S], fixedRoles: [], defaultRoles: [A, S] },
  "content.delete": { group: "Nội dung", label: "Xóa banner, FAQ, ảnh", eligibleRoles: [A], fixedRoles: [A], defaultRoles: [A] },
  "review.view": { group: "Đánh giá", label: "Xem đánh giá", eligibleRoles: [A, S, D], fixedRoles: [], defaultRoles: [A, S, D] },
  "review.moderate": { group: "Đánh giá", label: "Ẩn, hiện đánh giá", eligibleRoles: [A, S], fixedRoles: [], defaultRoles: [A, S] },

  // Hệ thống
  "settings.view": { group: "Hệ thống", label: "Xem cấu hình website", eligibleRoles: [A, S], fixedRoles: [], defaultRoles: [A, S] },
  "settings.edit": { group: "Hệ thống", label: "Sửa cấu hình website và trang chủ", eligibleRoles: [A], fixedRoles: [A], defaultRoles: [A] },
  "chatbot.view": { group: "Hệ thống", label: "Xem hội thoại chatbot (có thể chứa triệu chứng người dùng gõ vào)", eligibleRoles: [A, S], fixedRoles: [], defaultRoles: [A] },
  "chatbot.config": { group: "Hệ thống", label: "Cấu hình chatbot", eligibleRoles: [A], fixedRoles: [A], defaultRoles: [A] },
  "stats.view": { group: "Hệ thống", label: "Xem thống kê vận hành", eligibleRoles: [A, S], fixedRoles: [], defaultRoles: [A, S] },
  "stats.doctor": { group: "Hệ thống", label: "Xem bảng làm việc của bác sĩ", eligibleRoles: [D], fixedRoles: [D], defaultRoles: [D] },
  "user.manage": { group: "Hệ thống", label: "Quản lý tài khoản nhân sự", eligibleRoles: [A], fixedRoles: [A], defaultRoles: [A] },
  "audit.view": { group: "Hệ thống", label: "Xem nhật ký truy cập và thao tác nhạy cảm", eligibleRoles: [A], fixedRoles: [A], defaultRoles: [A] },
  "rbac.manage": { group: "Hệ thống", label: "Quản lý phân quyền", eligibleRoles: [A], fixedRoles: [A], defaultRoles: [A] },

  // Hộp thư cá nhân: mọi vai trò nhân sự đều có, không thể thu hồi
  "inbox.view": { group: "Hệ thống", label: "Xem hộp thư thông báo của chính mình", eligibleRoles: [A, S, D, P], fixedRoles: [A, S, D, P], defaultRoles: [A, S, D, P] },

  // Kho thuốc: chỉ dược sĩ
  "pharmacy.view": { group: "Kho thuốc", label: "Xem kho thuốc và đơn chờ cấp", eligibleRoles: [P], fixedRoles: [P], defaultRoles: [P] },
  "pharmacy.catalog": { group: "Kho thuốc", label: "Quản lý danh mục thuốc", eligibleRoles: [P], fixedRoles: [P], defaultRoles: [P] },
  "pharmacy.dispense": { group: "Kho thuốc", label: "Cấp thuốc theo đơn", eligibleRoles: [P], fixedRoles: [P], defaultRoles: [P] },
  "pharmacy.receive": { group: "Kho thuốc", label: "Nhập kho", eligibleRoles: [P], fixedRoles: [P], defaultRoles: [P] },
  "pharmacy.adjust": { group: "Kho thuốc", label: "Điều chỉnh tồn kho", eligibleRoles: [P], fixedRoles: [P], defaultRoles: [P] },
} as const satisfies Record<string, PermissionDefinition>;

export type PermissionCode = keyof typeof PERMISSIONS;
export const PERMISSION_CODES = Object.keys(PERMISSIONS) as PermissionCode[];

export const isPermissionCode = (value: string): value is PermissionCode =>
  Object.prototype.hasOwnProperty.call(PERMISSIONS, value);

export type PermissionGrants = Record<PermissionCode, StaffRole[]>;

const unique = <T,>(values: readonly T[]) => [...new Set(values)];

// Ghép cấu hình lưu trữ với ràng buộc cứng: chỉ giữ vai trò đủ điều kiện, luôn
// thêm vai trò cố định, mã quyền thiếu dùng giá trị mặc định, mã lạ bị bỏ.
export const normalizeGrants = (stored: unknown): PermissionGrants => {
  const source =
    stored && typeof stored === "object" && !Array.isArray(stored)
      ? (stored as Record<string, unknown>)
      : {};
  const grants = {} as PermissionGrants;

  for (const code of PERMISSION_CODES) {
    const definition: PermissionDefinition = PERMISSIONS[code];
    const raw = source[code];
    const requested = Array.isArray(raw)
      ? raw.filter((role): role is StaffRole => isStaffRole(role as string))
      : [...definition.defaultRoles];

    grants[code] = unique([
      ...requested.filter((role) => definition.eligibleRoles.includes(role)),
      ...definition.fixedRoles,
    ]);
  }

  return grants;
};

export const getDefaultGrants = (): PermissionGrants => normalizeGrants({});

export const permissionsForRole = (grants: PermissionGrants, role: Role | string) =>
  PERMISSION_CODES.filter((code) => grants[code].includes(role as StaffRole));
