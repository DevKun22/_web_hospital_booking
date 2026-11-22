"use client";

import { useState } from "react";
import { DsNotice, DsPageHeader, DsTabs, useActionToast } from "@/components/ds";
import { useAuth } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { BannersTab } from "./banners-tab";
import { FaqsTab } from "./faqs-tab";
import { HomeLayoutTab } from "./home-layout-tab";
import { SiteInfoTab } from "./site-info-tab";
import { tabs, type TabKey } from "./site-model";

// Cài đặt trang người dùng: bốn nhóm (thông tin công khai, bố cục trang chủ, ảnh quảng bá, hỏi đáp). Mỗi nhóm tự giữ biểu mẫu và truy vấn của mình;
// hai nhóm biểu mẫu luôn được gắn (chỉ ẩn) để chỉnh sửa chưa lưu không mất khi đổi nhóm, hai nhóm danh sách được gắn khi mở.

export default function SiteSettingsPage() {
  const { user } = useAuth();
  const canWrite = can(user, "settings.edit");
  const canManage = can(user, "settings.view");
  const [activeTab, setActiveTab] = useState<TabKey>("settings");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // Kết quả thao tác hiện thành thông báo nổi ở góc trên phải.
  useActionToast({ notice, error, clear: () => { setNotice(""); setError(""); } });

  if (!canManage) {
    return (
      <>
        <DsPageHeader title="Cài đặt trang" description="Phân hệ này chỉ dành cho tài khoản được cấp quyền xem cấu hình trang người dùng." />
        <DsNotice tone="info">Tài khoản của bạn chưa được cấp quyền xem cấu hình trang người dùng.</DsNotice>
      </>
    );
  }

  const shared = { canWrite, canManage, onNotice: setNotice, onError: setError };

  return (
    <>
      <DsPageHeader title="Cài đặt trang" description="Thông tin công khai, bố cục trang chủ, ảnh quảng bá và câu hỏi thường gặp trên trang người dùng." />
      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        <DsTabs label="Các nhóm cài đặt trang" items={tabs} value={activeTab} onChange={(id) => setActiveTab(id as TabKey)} />
      </div>
      <SiteInfoTab active={activeTab === "settings"} {...shared} />
      <HomeLayoutTab active={activeTab === "home"} {...shared} />
      {activeTab === "banners" ? <BannersTab {...shared} /> : null}
      {activeTab === "faqs" ? <FaqsTab {...shared} /> : null}
    </>
  );
}
