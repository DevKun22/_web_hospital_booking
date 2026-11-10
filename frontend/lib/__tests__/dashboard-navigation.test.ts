import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canAccessDashboardPath,
  getDashboardNavItem,
  getListedDashboardItems,
  getVisibleDashboardItems,
} from "@/lib/dashboard-navigation";
import type { DashboardUser } from "@/lib/types";

const userWith = (role: DashboardUser["role"], permissions: string[]) =>
  ({ id: `${role}-1`, role, fullName: role, permissions }) as unknown as DashboardUser;

const admin = userWith("ADMIN", [
  "appointment.view",
  "catalog.manage",
  "notification.broadcast",
  "rbac.manage",
  "user.manage",
  "settings.view",
  "stats.view",
  "audit.view",
]);
const doctor = userWith("DOCTOR", ["appointment.view", "record.view", "prescription.view", "schedule.view", "stats.doctor"]);
const pharmacist = userWith("PHARMACIST", ["pharmacy.view", "pharmacy.dispense", "prescription.view"]);

const hrefs = (user: DashboardUser) => getListedDashboardItems(user).map((item) => item.href);

describe("menu theo vai trò", () => {
  it("mọi nhân sự đều thấy Tổng quan và Thông báo của tôi", () => {
    for (const user of [admin, doctor, pharmacist]) {
      assert.ok(hrefs(user).includes("/dashboard"));
      assert.ok(hrefs(user).includes("/dashboard/inbox"));
    }
  });

  it("chỉ tài khoản có quyền tương ứng mới thấy Nhân sự và Phân quyền", () => {
    assert.ok(hrefs(admin).includes("/dashboard/users"));
    assert.ok(hrefs(admin).includes("/dashboard/permissions"));
    assert.ok(!hrefs(doctor).includes("/dashboard/users"));
    assert.ok(!hrefs(doctor).includes("/dashboard/permissions"));
    assert.ok(!hrefs(pharmacist).includes("/dashboard/users"));
  });

  it("trang gửi thông báo cần quyền riêng notification.broadcast", () => {
    assert.ok(hrefs(admin).includes("/dashboard/notifications"));
    assert.ok(!hrefs(doctor).includes("/dashboard/notifications"));
    assert.ok(!hrefs(userWith("STAFF", ["content.manage"])).includes("/dashboard/notifications"));
  });

  it("bác sĩ và dược sĩ có trang chủ riêng tên Việc của tôi", () => {
    assert.equal(getListedDashboardItems(doctor)[0].label, "Việc của tôi");
    assert.equal(getListedDashboardItems(pharmacist)[0].label, "Việc của tôi");
    assert.equal(getListedDashboardItems(admin)[0].label, "Tổng quan");
  });

  it("mục chỉ truy cập bằng đường dẫn không hiện trong menu nhưng vẫn truy cập được", () => {
    assert.ok(!hrefs(admin).includes("/dashboard/design-system"));
    assert.ok(getVisibleDashboardItems(admin).map((item) => item.href).includes("/dashboard/design-system"));
  });
});

describe("kiểm tra đường dẫn", () => {
  it("cho vào trang con của mục được phép và chặn mục không có quyền", () => {
    assert.equal(canAccessDashboardPath(admin, "/dashboard/users"), true);
    assert.equal(canAccessDashboardPath(admin, "/dashboard/users/abc"), true);
    assert.equal(canAccessDashboardPath(doctor, "/dashboard/users"), false);
    assert.equal(canAccessDashboardPath(pharmacist, "/dashboard/appointments"), false);
  });

  it("đường dẫn lạ không được cho qua", () => {
    assert.equal(canAccessDashboardPath(admin, "/dashboard/khong-ton-tai"), false);
  });

  it("chọn mục khớp dài nhất, và Tổng quan chỉ khớp đúng trang gốc", () => {
    assert.equal(getDashboardNavItem("/dashboard/inbox")?.key, "inbox");
    assert.equal(getDashboardNavItem("/dashboard")?.href, "/dashboard");
    assert.equal(getDashboardNavItem("/dashboard/appointments/xyz")?.href, "/dashboard/appointments");
  });
});
