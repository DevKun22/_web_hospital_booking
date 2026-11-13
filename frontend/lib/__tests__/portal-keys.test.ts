import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { portalKeys } from "@/features/portal/keys";

const startsWith = (key: readonly unknown[], prefix: readonly unknown[]) => prefix.every((part, index) => key[index] === part);

describe("portalKeys", () => {
  it("mọi khóa nằm dưới tiền tố chung để xóa hoặc làm mới một lần", () => {
    const keys = [
      portalKeys.overview,
      portalKeys.appointments,
      portalKeys.appointment("a"),
      portalKeys.appointmentReview("a"),
      portalKeys.invoices,
      portalKeys.invoice("i"),
      portalKeys.healthRecords,
      portalKeys.medicalRecord("m"),
      portalKeys.prescription("p"),
      portalKeys.profile,
      portalKeys.dependent("d"),
      portalKeys.sessions,
      portalKeys.notifications,
      portalKeys.notificationList("all", 1),
      portalKeys.unreadCount,
    ];
    for (const key of keys) assert.ok(startsWith(key, portalKeys.all), JSON.stringify(key));
  });

  it("làm mới danh sách kéo theo chi tiết, hồ sơ kéo theo người thân, thông báo kéo theo số chưa đọc", () => {
    assert.ok(startsWith(portalKeys.appointment("a"), portalKeys.appointments));
    assert.ok(startsWith(portalKeys.appointmentReview("a"), portalKeys.appointments));
    assert.ok(startsWith(portalKeys.invoice("i"), portalKeys.invoices));
    assert.ok(startsWith(portalKeys.dependent("d"), portalKeys.profile));
    assert.ok(startsWith(portalKeys.unreadCount, portalKeys.notifications));
    assert.ok(startsWith(portalKeys.notificationList("unread", 2), portalKeys.notifications));
  });

  it("khóa các mục khác nhau không trùng nhau", () => {
    assert.notDeepEqual(portalKeys.appointment("a"), portalKeys.appointment("b"));
    assert.notDeepEqual(portalKeys.notificationList("all", 1), portalKeys.notificationList("unread", 1));
    assert.ok(!startsWith(portalKeys.invoices, portalKeys.appointments));
  });
});
