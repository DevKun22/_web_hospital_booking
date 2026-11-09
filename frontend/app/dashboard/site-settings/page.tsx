"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DsButton,
  DsEmptyState,
  DsField,
  DsInput,
  DsNotice,
  DsPageHeader,
  DsPane,
  DsPanel,
  DsSelect,
  DsSplit,
  DsStatusPill,
  DsTabs,
  DsTextarea,
  DsToolbar,
} from "@/components/ds";
import { NumberStepper } from "@/components/ui/number-stepper";
import { VietnamDateTimeInput } from "@/components/ui/vietnam-datetime-input";
import { apiRequest, uploadImages } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useDashboardBanners, useDashboardFAQs, useDashboardHomePageConfig, useDashboardSiteSettings } from "@/lib/dashboard-site-settings-query";
import { formatVietnamDateTime, fromVietnamDateTimeInput, toVietnamDateTimeInput } from "@/lib/date";
import { can } from "@/lib/permissions";
import { publishPublicContentUpdated } from "@/lib/public-content-sync";
import { queryKeys } from "@/lib/query-keys";
import type { Banner, DashboardFAQ, HomePageConfigRecord, HomePageConfigValue, HomePageSectionConfig, MediaAsset, SiteSettingsRecord, SiteSettingsValue } from "@/lib/types";

type TabKey = "home" | "settings" | "banners" | "faqs";

type SiteForm = SiteSettingsValue & {
  logoAssetId: string;
  faviconAssetId: string;
  facebook: string;
  zalo: string;
  youtube: string;
  tiktok: string;
};

type BannerForm = {
  title: string;
  subtitle: string;
  image: string;
  imageAssetId: string;
  mobileImage: string;
  mobileImageAssetId: string;
  linkUrl: string;
  target: string;
  position: string;
  order: string;
  isActive: boolean;
  startAt: string;
  endAt: string;
};

type FAQForm = {
  question: string;
  answer: string;
  category: string;
  order: string;
  keywords: string;
  showOnWeb: boolean;
  useInChatbot: boolean;
  isActive: boolean;
};

type Pane =
  | { kind: "banner"; banner: Banner | null }
  | { kind: "faq"; faq: DashboardFAQ | null }
  | null;

const tabs: { id: TabKey; label: string }[] = [
  { id: "settings", label: "Thông tin trang" },
  { id: "home", label: "Bố cục trang chủ" },
  { id: "banners", label: "Ảnh quảng bá" },
  { id: "faqs", label: "Câu hỏi thường gặp" },
];

const emptyHomePageForm: HomePageConfigValue = {
  announcement: {
    enabled: true,
    label: "Chương trình sức khỏe",
    message: "Chủ động chọn bác sĩ, ngày khám và gói chăm sóc phù hợp cho bạn và gia đình.",
    ctaLabel: "Xem chương trình",
    ctaHref: "/goi-kham",
    startAt: null,
    endAt: null,
  },
  sections: {
    serviceHub: { enabled: true },
    departments: { enabled: true, eyebrow: "Chuyên khoa mũi nhọn", title: "Trung tâm chẩn đoán và điều trị toàn diện", description: "Tìm đúng chuyên khoa theo nhu cầu khám.", limit: 4 },
    doctors: { enabled: true, eyebrow: "Chuyên gia đầu ngành", title: "Bác sĩ tiêu biểu đang tiếp nhận lịch khám", description: "Xem chuyên môn, đánh giá, chi phí và các giờ khám gần nhất.", limit: 3 },
    packages: { enabled: true, eyebrow: "Chủ động phòng ngừa bệnh", title: "Gói khám sức khỏe và tầm soát toàn diện", description: "So sánh minh bạch chi phí và hạng mục thực hiện.", limit: 3 },
    partners: { enabled: true, eyebrow: "Mạng lưới đồng hành", title: "Kết nối hệ sinh thái chăm sóc sức khỏe", description: "Các đơn vị hợp tác đã được xác thực và công bố.", limit: 12 },
  },
};

const configurableHomeSections: Array<{
  key: "departments" | "doctors" | "packages" | "partners";
  label: string;
}> = [
  { key: "departments", label: "Chuyên khoa" },
  { key: "doctors", label: "Bác sĩ" },
  { key: "packages", label: "Gói khám" },
  { key: "partners", label: "Đối tác" },
];

const emptySiteForm: SiteForm = {
  hospitalName: "",
  logo: "",
  logoAssetId: "",
  favicon: "",
  faviconAssetId: "",
  hotline: "",
  emergencyHotline: "",
  email: "",
  address: "",
  workingHours: "",
  mapUrl: "",
  socialLinks: {},
  facebook: "",
  zalo: "",
  youtube: "",
  tiktok: "",
};

const emptyBannerForm: BannerForm = {
  title: "",
  subtitle: "",
  image: "",
  imageAssetId: "",
  mobileImage: "",
  mobileImageAssetId: "",
  linkUrl: "",
  target: "_self",
  position: "HOME_HERO",
  order: "0",
  isActive: true,
  startAt: "",
  endAt: "",
};

const emptyFAQForm: FAQForm = {
  question: "",
  answer: "",
  category: "booking",
  order: "0",
  keywords: "",
  showOnWeb: true,
  useInChatbot: true,
  isActive: true,
};

const positionLabels: Record<string, string> = {
  HOME_HERO: "Ảnh lớn đầu trang chủ",
  HOME_PARTNER: "Dải đối tác",
};
const faqCategoryLabels: Record<string, string> = {
  booking: "Đặt lịch",
  payment: "Thanh toán",
  doctor: "Bác sĩ",
  insurance: "Bảo hiểm",
  general: "Chung",
};

const toNullable = (value: string) => value.trim() || null;

const toSiteForm = (settings?: SiteSettingsValue): SiteForm => {
  const socialLinks = settings?.socialLinks || {};
  return {
    ...emptySiteForm,
    ...settings,
    hospitalName: settings?.hospitalName || "",
    logo: settings?.logo || "",
    logoAssetId: "",
    favicon: settings?.favicon || "",
    faviconAssetId: "",
    hotline: settings?.hotline || "",
    emergencyHotline: settings?.emergencyHotline || "",
    email: settings?.email || "",
    address: settings?.address || "",
    workingHours: settings?.workingHours || "",
    mapUrl: settings?.mapUrl || "",
    socialLinks,
    facebook: socialLinks.facebook || "",
    zalo: socialLinks.zalo || "",
    youtube: socialLinks.youtube || "",
    tiktok: socialLinks.tiktok || "",
  };
};

const toBannerForm = (banner: Banner): BannerForm => ({
  title: banner.title,
  subtitle: banner.subtitle || "",
  image: banner.image,
  imageAssetId: "",
  mobileImage: banner.mobileImage || "",
  mobileImageAssetId: "",
  linkUrl: banner.linkUrl || "",
  target: banner.target || "_self",
  position: banner.position,
  order: String(banner.order),
  isActive: banner.isActive,
  startAt: toVietnamDateTimeInput(banner.startAt),
  endAt: toVietnamDateTimeInput(banner.endAt),
});

const toFAQForm = (faq: DashboardFAQ): FAQForm => ({
  question: faq.question,
  answer: faq.answer,
  category: faq.category || "",
  order: String(faq.order),
  keywords: faq.keywords.join(", "),
  showOnWeb: faq.showOnWeb,
  useInChatbot: faq.useInChatbot,
  isActive: faq.isActive,
});

const parseKeywords = (value: string) =>
  Array.from(new Set(value.split(",").map((item) => item.trim()).filter(Boolean)));

function Check({ id, checked, disabled, onChange, label, hint }: { id: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void; label: string; hint?: string }) {
  return (
    <div className="ds-check">
      <input id={id} type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <label htmlFor={id}>
        {label}
        {hint ? <small>{hint}</small> : null}
      </label>
    </div>
  );
}

export default function SiteSettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = can(user, "settings.edit");
  const canManage = can(user, "settings.view");
  const [activeTab, setActiveTab] = useState<TabKey>("settings");
  const [homeForm, setHomeForm] = useState<HomePageConfigValue>(emptyHomePageForm);
  const [siteForm, setSiteForm] = useState<SiteForm>(emptySiteForm);
  const [homeDirty, setHomeDirty] = useState(false);
  const [siteDirty, setSiteDirty] = useState(false);
  const [homeReady, setHomeReady] = useState(false);
  const [siteReady, setSiteReady] = useState(false);
  const [pane, setPane] = useState<Pane>(null);
  const [bannerForm, setBannerForm] = useState<BannerForm>(emptyBannerForm);
  const [faqForm, setFAQForm] = useState<FAQForm>(emptyFAQForm);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [bannerPosition, setBannerPosition] = useState("");
  const [bannerActive, setBannerActive] = useState("");
  const [faqCategory, setFAQCategory] = useState("");
  const [faqActive, setFAQActive] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const bannerQuery = useMemo(
    () => ({ position: bannerPosition || undefined, isActive: bannerActive || undefined }),
    [bannerPosition, bannerActive],
  );
  const faqQuery = useMemo(
    () => ({ category: faqCategory || undefined, isActive: faqActive || undefined }),
    [faqCategory, faqActive],
  );
  const siteSettingsQuery = useDashboardSiteSettings(canManage && activeTab === "settings");
  const homeConfigQuery = useDashboardHomePageConfig(canManage && activeTab === "home");
  const bannersQuery = useDashboardBanners(bannerQuery, canManage && activeTab === "banners");
  const faqsQuery = useDashboardFAQs(faqQuery, canManage && activeTab === "faqs");
  const siteRecord = siteSettingsQuery.data;
  const banners = bannersQuery.data ?? [];
  const faqs = faqsQuery.data ?? [];
  const queryFailure = homeConfigQuery.error || siteSettingsQuery.error || bannersQuery.error || faqsQuery.error;
  const queryError = queryFailure instanceof Error ? queryFailure.message : queryFailure ? "Không tải được cấu hình trang người dùng" : "";

  const invalidateSiteSettings = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSiteSettings }),
      queryClient.invalidateQueries({ queryKey: queryKeys.publicSiteSettings }),
      queryClient.invalidateQueries({ queryKey: queryKeys.publicHome }),
    ]);
    publishPublicContentUpdated();
  };
  const invalidateHomePageConfig = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardHomePageConfig }),
      queryClient.invalidateQueries({ queryKey: queryKeys.publicHome }),
    ]);
    publishPublicContentUpdated();
  };
  const invalidateBanners = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard", "banners"] }),
      queryClient.invalidateQueries({ queryKey: ["public", "banners"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.publicHome }),
    ]);
    publishPublicContentUpdated();
  };
  const invalidateFAQs = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard", "faqs"] }),
      queryClient.invalidateQueries({ queryKey: ["public", "faqs"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.publicHome }),
    ]);
    publishPublicContentUpdated();
  };

  useEffect(() => {
    if (!siteSettingsQuery.data || siteReady) return;
    const timeoutId = window.setTimeout(() => {
      if (!siteSettingsQuery.data) return;
      setSiteReady(true);
      setSiteForm(toSiteForm(siteSettingsQuery.data.value));
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [siteSettingsQuery.data, siteReady]);

  useEffect(() => {
    if (!homeConfigQuery.data || homeReady) return;
    const timeoutId = window.setTimeout(() => {
      if (!homeConfigQuery.data) return;
      setHomeReady(true);
      setHomeForm(homeConfigQuery.data.value);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [homeConfigQuery.data, homeReady]);

  useEffect(() => {
    if (!notice && !error) return;
    const timeoutId = window.setTimeout(() => {
      setNotice("");
      setError("");
    }, 4500);
    return () => window.clearTimeout(timeoutId);
  }, [error, notice]);

  const closePane = () => {
    setPane(null);
    setConfirmDelete(false);
  };

  const changeTab = (id: string) => {
    setActiveTab(id as TabKey);
    closePane();
  };

  const updateSite = (patch: Partial<SiteForm>) => {
    setSiteForm((current) => ({ ...current, ...patch }));
    setSiteDirty(true);
  };
  const updateHome = (updater: (current: HomePageConfigValue) => HomePageConfigValue) => {
    setHomeForm(updater);
    setHomeDirty(true);
  };
  const updateAnnouncement = (patch: Partial<HomePageConfigValue["announcement"]>) =>
    updateHome((current) => ({ ...current, announcement: { ...current.announcement, ...patch } }));
  const updateSection = (key: keyof HomePageConfigValue["sections"], patch: Partial<HomePageSectionConfig>) =>
    updateHome((current) => ({ ...current, sections: { ...current.sections, [key]: { ...current.sections[key], ...patch } } }));

  const uploadToForm = async (file: File | undefined, folder: string, key: string, setter: (asset: MediaAsset) => void) => {
    if (!file) return;
    setUploading(key);
    setError("");
    setNotice("");
    try {
      const [asset] = await uploadImages([file], folder);
      if (!asset) throw new Error("Đã tải ảnh nhưng không nhận được đường dẫn ảnh");
      setter(asset);
      setNotice("Đã tải ảnh lên");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được ảnh lên");
    } finally {
      setUploading("");
    }
  };

  const saveHomePageConfig = async () => {
    if (!canWrite) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const updated = await apiRequest<HomePageConfigRecord>("/dashboard/homepage-config", { method: "PATCH", body: homeForm });
      queryClient.setQueryData(queryKeys.dashboardHomePageConfig, updated);
      setHomeForm(updated.value);
      setHomeDirty(false);
      await invalidateHomePageConfig();
      setNotice("Đã cập nhật bố cục và nội dung trang chủ");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được cấu hình trang chủ");
    } finally {
      setSaving(false);
    }
  };

  const saveSiteSettings = async () => {
    if (!canWrite) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const socialLinks = {
        ...(siteForm.facebook.trim() ? { facebook: siteForm.facebook.trim() } : {}),
        ...(siteForm.zalo.trim() ? { zalo: siteForm.zalo.trim() } : {}),
        ...(siteForm.youtube.trim() ? { youtube: siteForm.youtube.trim() } : {}),
        ...(siteForm.tiktok.trim() ? { tiktok: siteForm.tiktok.trim() } : {}),
      };
      const payload: Partial<SiteSettingsValue> & { logoAssetId?: string; faviconAssetId?: string } = {
        hospitalName: toNullable(siteForm.hospitalName || ""),
        logo: toNullable(siteForm.logo || ""),
        logoAssetId: siteForm.logoAssetId || undefined,
        favicon: toNullable(siteForm.favicon || ""),
        faviconAssetId: siteForm.faviconAssetId || undefined,
        hotline: toNullable(siteForm.hotline || ""),
        emergencyHotline: toNullable(siteForm.emergencyHotline || ""),
        email: toNullable(siteForm.email || ""),
        address: toNullable(siteForm.address || ""),
        workingHours: toNullable(siteForm.workingHours || ""),
        mapUrl: toNullable(siteForm.mapUrl || ""),
        socialLinks,
      };
      const updated = await apiRequest<SiteSettingsRecord>("/dashboard/site-settings", { method: "PATCH", body: payload });
      queryClient.setQueryData(queryKeys.dashboardSiteSettings, updated);
      setSiteForm(toSiteForm(updated.value));
      setSiteDirty(false);
      await invalidateSiteSettings();
      setNotice("Đã cập nhật thông tin trang người dùng");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được thông tin trang người dùng");
    } finally {
      setSaving(false);
    }
  };

  const openBanner = (banner: Banner | null) => {
    setBannerForm(banner ? toBannerForm(banner) : emptyBannerForm);
    setConfirmDelete(false);
    setPane({ kind: "banner", banner });
  };

  const saveBanner = async () => {
    if (!canManage || pane?.kind !== "banner") return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const body = {
        title: bannerForm.title.trim(),
        subtitle: toNullable(bannerForm.subtitle),
        image: bannerForm.image.trim(),
        imageAssetId: bannerForm.imageAssetId || undefined,
        mobileImage: toNullable(bannerForm.mobileImage),
        mobileImageAssetId: bannerForm.mobileImageAssetId || undefined,
        linkUrl: toNullable(bannerForm.linkUrl),
        target: toNullable(bannerForm.target),
        position: bannerForm.position.trim() || "HOME_HERO",
        order: Number(bannerForm.order || 0),
        isActive: bannerForm.isActive,
        startAt: fromVietnamDateTimeInput(bannerForm.startAt),
        endAt: fromVietnamDateTimeInput(bannerForm.endAt),
      };
      if (pane.banner) {
        await apiRequest<Banner>(`/dashboard/banners/${pane.banner.id}`, { method: "PATCH", body });
        setNotice("Đã cập nhật ảnh quảng bá");
      } else {
        await apiRequest<Banner>("/dashboard/banners", { method: "POST", body });
        setNotice("Đã tạo ảnh quảng bá");
      }
      closePane();
      await invalidateBanners();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được ảnh quảng bá");
    } finally {
      setSaving(false);
    }
  };

  const toggleBanner = async (banner: Banner) => {
    if (!canManage) return;
    setError("");
    setNotice("");
    try {
      await apiRequest<Banner>(`/dashboard/banners/${banner.id}`, { method: "PATCH", body: { isActive: !banner.isActive } });
      setNotice(banner.isActive ? "Đã tắt ảnh quảng bá" : "Đã bật ảnh quảng bá");
      await invalidateBanners();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được ảnh quảng bá");
    }
  };

  const deleteBanner = async () => {
    if (!canWrite || pane?.kind !== "banner" || !pane.banner) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await apiRequest<Banner>(`/dashboard/banners/${pane.banner.id}`, { method: "DELETE" });
      closePane();
      setNotice("Đã xoá ảnh quảng bá");
      await invalidateBanners();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xoá được ảnh quảng bá");
    } finally {
      setSaving(false);
    }
  };

  const openFAQ = (faq: DashboardFAQ | null) => {
    setFAQForm(faq ? toFAQForm(faq) : emptyFAQForm);
    setConfirmDelete(false);
    setPane({ kind: "faq", faq });
  };

  const saveFAQ = async () => {
    if (!canManage || pane?.kind !== "faq") return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const body = {
        question: faqForm.question.trim(),
        answer: faqForm.answer.trim(),
        category: toNullable(faqForm.category),
        order: Number(faqForm.order || 0),
        keywords: parseKeywords(faqForm.keywords),
        showOnWeb: faqForm.showOnWeb,
        useInChatbot: faqForm.useInChatbot,
        isActive: faqForm.isActive,
      };
      if (pane.faq) {
        await apiRequest<DashboardFAQ>(`/dashboard/faqs/${pane.faq.id}`, { method: "PATCH", body });
        setNotice("Đã cập nhật câu hỏi thường gặp");
      } else {
        await apiRequest<DashboardFAQ>("/dashboard/faqs", { method: "POST", body });
        setNotice("Đã tạo câu hỏi thường gặp");
      }
      closePane();
      await invalidateFAQs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được câu hỏi thường gặp");
    } finally {
      setSaving(false);
    }
  };

  const toggleFAQ = async (faq: DashboardFAQ) => {
    if (!canManage) return;
    setError("");
    setNotice("");
    try {
      await apiRequest<DashboardFAQ>(`/dashboard/faqs/${faq.id}`, { method: "PATCH", body: { isActive: !faq.isActive } });
      setNotice(faq.isActive ? "Đã tắt câu hỏi" : "Đã bật câu hỏi");
      await invalidateFAQs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được câu hỏi");
    }
  };

  const deleteFAQ = async () => {
    if (!canWrite || pane?.kind !== "faq" || !pane.faq) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await apiRequest<DashboardFAQ>(`/dashboard/faqs/${pane.faq.id}`, { method: "DELETE" });
      closePane();
      setNotice("Đã xoá câu hỏi thường gặp");
      await invalidateFAQs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xoá được câu hỏi thường gặp");
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) {
    return (
      <>
        <DsPageHeader title="Cài đặt trang" description="Phân hệ này chỉ dành cho tài khoản được cấp quyền xem cấu hình trang người dùng." />
        <DsNotice tone="info">Tài khoản của bạn chưa được cấp quyền xem cấu hình trang người dùng.</DsNotice>
      </>
    );
  }

  const tabBar = <DsTabs label="Các nhóm cài đặt trang" items={tabs} value={activeTab} onChange={changeTab} />;

  const saveBar = (dirty: boolean, onSave: () => void, label: string) =>
    canWrite ? (
      <div className="ds-savebar">
        <span className="ds-savebar__msg">{dirty ? "Có thay đổi chưa lưu" : "Chưa có thay đổi"}</span>
        <DsButton variant="primary" disabled={!dirty || saving || Boolean(uploading)} onClick={onSave}>
          {saving ? "Đang lưu..." : label}
        </DsButton>
      </div>
    ) : (
      <div className="ds-savebar">
        <span className="ds-savebar__msg">Bạn chỉ có quyền xem; chỉ quản trị viên được cập nhật.</span>
      </div>
    );

  const imageField = (key: "logo" | "favicon", label: string) => (
    <div style={{ display: "grid", gap: 8 }}>
      <DsField label={label} htmlFor={`site-${key}`} hint="Dán đường dẫn ảnh hoặc tải ảnh lên bên dưới">
        <DsInput id={`site-${key}`} disabled={!canWrite} value={siteForm[key] || ""} placeholder="https://..." onChange={(event) => updateSite({ [key]: event.target.value, [`${key}AssetId`]: "" } as Partial<SiteForm>)} />
      </DsField>
      {canWrite ? (
        <input
          type="file"
          aria-label={`Tải ${label} lên`}
          disabled={uploading === key}
          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,.ico"
          onChange={(event) => void uploadToForm(event.target.files?.[0], "site-settings", key, (asset) => updateSite({ [key]: asset.url, [`${key}AssetId`]: asset.id } as Partial<SiteForm>))}
        />
      ) : null}
      {uploading === key ? <span role="status" className="ds-hint">Đang tải ảnh lên...</span> : null}
      {siteForm[key] ? <img src={siteForm[key] || ""} alt={`Xem trước ${label}`} style={{ height: 80, maxWidth: "100%", objectFit: "contain", borderRadius: 6, background: "var(--ds-sunken)", padding: 6 }} /> : null}
    </div>
  );

  const settingsTab = (
    <DsPanel title="Thông tin hiển thị công khai" actions={<span className="ds-hint">Cập nhật {siteRecord?.updatedAt ? formatVietnamDateTime(siteRecord.updatedAt) : "-"}</span>}>
      {siteSettingsQuery.isLoading ? (
        <p className="ds-hint">Đang tải...</p>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          <div className="ds-grid-fields">
            <DsField label="Tên bệnh viện" htmlFor="site-name">
              <DsInput id="site-name" disabled={!canWrite} value={siteForm.hospitalName || ""} onChange={(event) => updateSite({ hospitalName: event.target.value })} />
            </DsField>
            <DsField label="Email" htmlFor="site-email">
              <DsInput id="site-email" disabled={!canWrite} value={siteForm.email || ""} onChange={(event) => updateSite({ email: event.target.value })} />
            </DsField>
            <DsField label="Hotline" htmlFor="site-hotline">
              <DsInput id="site-hotline" disabled={!canWrite} value={siteForm.hotline || ""} onChange={(event) => updateSite({ hotline: event.target.value })} />
            </DsField>
            <DsField label="Hotline cấp cứu" htmlFor="site-emergency">
              <DsInput id="site-emergency" disabled={!canWrite} value={siteForm.emergencyHotline || ""} onChange={(event) => updateSite({ emergencyHotline: event.target.value })} />
            </DsField>
          </div>
          <DsField label="Địa chỉ" htmlFor="site-address">
            <DsTextarea id="site-address" rows={2} disabled={!canWrite} value={siteForm.address || ""} onChange={(event) => updateSite({ address: event.target.value })} />
          </DsField>
          <div className="ds-grid-fields">
            <DsField label="Giờ làm việc" htmlFor="site-hours">
              <DsTextarea id="site-hours" rows={2} disabled={!canWrite} value={siteForm.workingHours || ""} onChange={(event) => updateSite({ workingHours: event.target.value })} />
            </DsField>
            <DsField label="Đường dẫn bản đồ" htmlFor="site-map">
              <DsTextarea id="site-map" rows={2} disabled={!canWrite} value={siteForm.mapUrl || ""} onChange={(event) => updateSite({ mapUrl: event.target.value })} />
            </DsField>
          </div>
          <div className="ds-grid-fields">
            {(["facebook", "zalo", "youtube", "tiktok"] as const).map((key) => (
              <DsField key={key} label={key === "facebook" ? "Facebook" : key === "zalo" ? "Zalo" : key === "youtube" ? "YouTube" : "TikTok"} htmlFor={`site-${key}`}>
                <DsInput id={`site-${key}`} disabled={!canWrite} value={siteForm[key]} onChange={(event) => updateSite({ [key]: event.target.value } as Partial<SiteForm>)} />
              </DsField>
            ))}
          </div>
          <div className="ds-grid-fields">
            {imageField("logo", "Logo")}
            {imageField("favicon", "Favicon")}
          </div>
        </div>
      )}
      {saveBar(siteDirty, () => void saveSiteSettings(), "Lưu thông tin")}
    </DsPanel>
  );

  const homeTab = (
    <div style={{ display: "grid", gap: 16 }}>
      <DsPanel title="Thanh chương trình dưới ảnh lớn" actions={<Check id="ann-enabled" checked={homeForm.announcement.enabled} disabled={!canWrite} onChange={(enabled) => updateAnnouncement({ enabled })} label="Hiển thị" />}>
        <p className="ds-hint" style={{ marginTop: 0 }}>Nội dung công khai chạy trên trang chủ; không tạo thông báo đẩy tới tài khoản.</p>
        <div className="ds-grid-fields">
          <DsField label="Nhãn chương trình" htmlFor="ann-label">
            <DsInput id="ann-label" disabled={!canWrite} value={homeForm.announcement.label} onChange={(event) => updateAnnouncement({ label: event.target.value })} />
          </DsField>
          <DsField label="Nhãn nút" htmlFor="ann-cta">
            <DsInput id="ann-cta" disabled={!canWrite} value={homeForm.announcement.ctaLabel} onChange={(event) => updateAnnouncement({ ctaLabel: event.target.value })} />
          </DsField>
        </div>
        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          <DsField label="Nội dung chạy" htmlFor="ann-message">
            <DsTextarea id="ann-message" rows={2} disabled={!canWrite} value={homeForm.announcement.message} onChange={(event) => updateAnnouncement({ message: event.target.value })} />
          </DsField>
          <DsField label="Đường dẫn nút" htmlFor="ann-href">
            <DsInput id="ann-href" disabled={!canWrite} value={homeForm.announcement.ctaHref} placeholder="/goi-kham" onChange={(event) => updateAnnouncement({ ctaHref: event.target.value })} />
          </DsField>
          <div className="ds-grid-fields">
            <DsField label="Bắt đầu hiển thị" hint="Để trống: hiển thị ngay">
              <VietnamDateTimeInput ariaLabel="Bắt đầu hiển thị" disabled={!canWrite} value={toVietnamDateTimeInput(homeForm.announcement.startAt)} onChange={(value) => updateAnnouncement({ startAt: fromVietnamDateTimeInput(value) })} />
            </DsField>
            <DsField label="Kết thúc hiển thị" hint="Để trống: hiển thị mãi">
              <VietnamDateTimeInput ariaLabel="Kết thúc hiển thị" disabled={!canWrite} value={toVietnamDateTimeInput(homeForm.announcement.endAt)} onChange={(value) => updateAnnouncement({ endAt: fromVietnamDateTimeInput(value) })} />
            </DsField>
          </div>
        </div>
      </DsPanel>

      <div className="ds-grid-fields">
        {configurableHomeSections.map(({ key, label }) => {
          const section = homeForm.sections[key];
          return (
            <DsPanel key={key} title={`Khối ${label}`} actions={<Check id={`sec-${key}`} checked={section.enabled} disabled={!canWrite} onChange={(enabled) => updateSection(key, { enabled })} label="Hiển thị" />}>
              <div style={{ display: "grid", gap: 12 }}>
                <DsField label="Nhãn nhỏ" htmlFor={`sec-${key}-eyebrow`}>
                  <DsInput id={`sec-${key}-eyebrow`} disabled={!canWrite} value={section.eyebrow} onChange={(event) => updateSection(key, { eyebrow: event.target.value })} />
                </DsField>
                <DsField label="Tiêu đề" htmlFor={`sec-${key}-title`} required>
                  <DsInput id={`sec-${key}-title`} disabled={!canWrite} value={section.title} onChange={(event) => updateSection(key, { title: event.target.value })} />
                </DsField>
                <DsField label="Mô tả" htmlFor={`sec-${key}-desc`}>
                  <DsTextarea id={`sec-${key}-desc`} rows={2} disabled={!canWrite} value={section.description} onChange={(event) => updateSection(key, { description: event.target.value })} />
                </DsField>
                <DsField label="Số mục hiển thị">
                  <NumberStepper label={`Số mục hiển thị của khối ${label}`} value={section.limit} min={1} max={12} disabled={!canWrite || saving} onChange={(limit) => updateSection(key, { limit })} />
                </DsField>
              </div>
            </DsPanel>
          );
        })}
      </div>

      <DsPanel title="Vùng chức năng cố định">
        <Check id="sec-serviceHub" checked={homeForm.sections.serviceHub.enabled} disabled={!canWrite} onChange={(enabled) => updateSection("serviceHub", { enabled })} label="Dịch vụ nhanh" hint="Các lối tắt đặt lịch, tra cứu và hỗ trợ ngay dưới ảnh lớn" />
        {saveBar(homeDirty, () => void saveHomePageConfig(), "Lưu bố cục trang chủ")}
      </DsPanel>
    </div>
  );

  const open = pane !== null;

  const bannerList = (
    <DsPanel flush>
      <DsToolbar>
        <div style={{ minWidth: 160, flex: "1 1 200px" }}>
          <DsSelect aria-label="Lọc theo vị trí" value={bannerPosition} onChange={(event) => setBannerPosition(event.target.value)}>
            <option value="">Mọi vị trí</option>
            {Object.entries(positionLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </DsSelect>
        </div>
        <div style={{ minWidth: 140 }}>
          <DsSelect aria-label="Lọc theo trạng thái" value={bannerActive} onChange={(event) => setBannerActive(event.target.value)}>
            <option value="">Mọi trạng thái</option>
            <option value="true">Đang bật</option>
            <option value="false">Đang tắt</option>
          </DsSelect>
        </div>
        <DsButton variant="primary" onClick={() => openBanner(null)}>Tạo ảnh quảng bá</DsButton>
      </DsToolbar>
      {bannersQuery.isLoading ? (
        <p className="ds-hint" style={{ padding: 16 }}>Đang tải...</p>
      ) : banners.length ? (
        <div role="listbox" aria-label="Danh sách ảnh quảng bá">
          {banners.map((banner) => (
            <button key={banner.id} type="button" role="option" className="ds-listrow" aria-selected={pane?.kind === "banner" && pane.banner?.id === banner.id} onClick={() => openBanner(banner)}>
              <img src={banner.image} alt="" style={{ width: open ? 56 : 120, height: open ? 36 : 64, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
              <span className="ds-listrow__main">
                <strong>{banner.title}</strong>
                <small>{positionLabels[banner.position] || banner.position} · thứ tự {banner.order}{banner.linkUrl && !open ? ` · ${banner.linkUrl}` : ""}</small>
              </span>
              <DsStatusPill tone={banner.isActive ? "good" : "neutral"}>{banner.isActive ? "Đang bật" : "Đang tắt"}</DsStatusPill>
            </button>
          ))}
        </div>
      ) : (
        <DsEmptyState title="Chưa có ảnh quảng bá phù hợp" />
      )}
    </DsPanel>
  );

  const imagePicker = (key: "image" | "mobileImage", label: string) => (
    <div style={{ display: "grid", gap: 8 }}>
      <DsField label={label} htmlFor={`bn-${key}`} required={key === "image"}>
        <DsInput id={`bn-${key}`} value={bannerForm[key]} placeholder="https://..." onChange={(event) => setBannerForm((current) => ({ ...current, [key]: event.target.value, [`${key}AssetId`]: "" }))} />
      </DsField>
      <input
        type="file"
        aria-label={`Tải ${label} lên`}
        disabled={uploading === `banner-${key}`}
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(event) => void uploadToForm(event.target.files?.[0], "banners", `banner-${key}`, (asset) => setBannerForm((current) => ({ ...current, [key]: asset.url, [`${key}AssetId`]: asset.id })))}
      />
      {uploading === `banner-${key}` ? <span role="status" className="ds-hint">Đang tải ảnh lên...</span> : null}
      {bannerForm[key] ? <img src={bannerForm[key]} alt={`Xem trước ${label}`} style={{ maxHeight: 120, maxWidth: "100%", objectFit: "contain", borderRadius: 6, background: "var(--ds-sunken)" }} /> : null}
    </div>
  );

  const bannerPane =
    pane?.kind === "banner" ? (
      <DsPane
        title={pane.banner ? "Sửa ảnh quảng bá" : "Tạo ảnh quảng bá"}
        badge={pane.banner ? <DsStatusPill tone={pane.banner.isActive ? "good" : "neutral"}>{pane.banner.isActive ? "Đang bật" : "Đang tắt"}</DsStatusPill> : undefined}
        onClose={closePane}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <DsField label="Tiêu đề" htmlFor="bn-title" required>
            <DsInput id="bn-title" value={bannerForm.title} onChange={(event) => setBannerForm((current) => ({ ...current, title: event.target.value }))} />
          </DsField>
          <DsField label="Mô tả phụ" htmlFor="bn-subtitle">
            <DsTextarea id="bn-subtitle" rows={2} value={bannerForm.subtitle} onChange={(event) => setBannerForm((current) => ({ ...current, subtitle: event.target.value }))} />
          </DsField>
          {imagePicker("image", "Ảnh trên máy tính")}
          {imagePicker("mobileImage", "Ảnh trên điện thoại")}
          <div className="ds-grid-fields">
            <DsField label="Vị trí" htmlFor="bn-position">
              <DsSelect id="bn-position" value={bannerForm.position} onChange={(event) => setBannerForm((current) => ({ ...current, position: event.target.value }))}>
                {Object.entries(positionLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </DsSelect>
            </DsField>
            <DsField label="Thứ tự" hint="Số nhỏ hiển thị trước">
              <NumberStepper label="Thứ tự hiển thị" value={Number(bannerForm.order || 0)} min={0} max={999} onChange={(value) => setBannerForm((current) => ({ ...current, order: String(value) }))} />
            </DsField>
          </div>
          <div className="ds-grid-fields">
            <DsField label="Đường dẫn khi bấm" htmlFor="bn-link">
              <DsInput id="bn-link" value={bannerForm.linkUrl} placeholder="/goi-kham" onChange={(event) => setBannerForm((current) => ({ ...current, linkUrl: event.target.value }))} />
            </DsField>
            <DsField label="Cách mở" htmlFor="bn-target">
              <DsSelect id="bn-target" value={bannerForm.target} onChange={(event) => setBannerForm((current) => ({ ...current, target: event.target.value }))}>
                <option value="_self">Cùng tab</option>
                <option value="_blank">Tab mới</option>
              </DsSelect>
            </DsField>
          </div>
          <div className="ds-grid-fields">
            <DsField label="Bắt đầu" hint="Để trống: hiển thị ngay">
              <VietnamDateTimeInput ariaLabel="Bắt đầu hiển thị ảnh" value={bannerForm.startAt} onChange={(value) => setBannerForm((current) => ({ ...current, startAt: value }))} />
            </DsField>
            <DsField label="Kết thúc" hint="Để trống: hiển thị mãi">
              <VietnamDateTimeInput ariaLabel="Kết thúc hiển thị ảnh" value={bannerForm.endAt} onChange={(value) => setBannerForm((current) => ({ ...current, endAt: value }))} />
            </DsField>
          </div>
          <Check id="bn-active" checked={bannerForm.isActive} onChange={(isActive) => setBannerForm((current) => ({ ...current, isActive }))} label="Đang bật" />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {pane.banner ? (
              <>
                <DsButton onClick={() => void toggleBanner(pane.banner as Banner)}>{pane.banner.isActive ? "Tắt ngay" : "Bật ngay"}</DsButton>
                {canWrite ? <DsButton variant="ghost" onClick={() => setConfirmDelete(true)}>Xoá</DsButton> : null}
              </>
            ) : null}
            <DsButton onClick={closePane}>Đóng</DsButton>
            <DsButton variant="primary" disabled={saving || Boolean(uploading) || !bannerForm.title.trim() || !bannerForm.image.trim()} onClick={() => void saveBanner()}>
              {saving ? "Đang lưu..." : pane.banner ? "Lưu thay đổi" : "Tạo ảnh quảng bá"}
            </DsButton>
          </div>
          {confirmDelete && pane.banner ? (
            <DsNotice tone="bad">
              <div style={{ display: "grid", gap: 8 }}>
                <span>Xoá ảnh quảng bá “{pane.banner.title}”? Không hoàn tác được.</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <DsButton variant="danger" disabled={saving} onClick={() => void deleteBanner()}>Xoá ảnh</DsButton>
                  <DsButton onClick={() => setConfirmDelete(false)}>Giữ lại</DsButton>
                </div>
              </div>
            </DsNotice>
          ) : null}
        </div>
      </DsPane>
    ) : null;

  const faqList = (
    <DsPanel flush>
      <DsToolbar>
        <div style={{ minWidth: 160, flex: "1 1 200px" }}>
          <DsSelect aria-label="Lọc theo nhóm" value={faqCategory} onChange={(event) => setFAQCategory(event.target.value)}>
            <option value="">Mọi nhóm</option>
            {Object.entries(faqCategoryLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </DsSelect>
        </div>
        <div style={{ minWidth: 140 }}>
          <DsSelect aria-label="Lọc theo trạng thái" value={faqActive} onChange={(event) => setFAQActive(event.target.value)}>
            <option value="">Mọi trạng thái</option>
            <option value="true">Đang bật</option>
            <option value="false">Đang tắt</option>
          </DsSelect>
        </div>
        <DsButton variant="primary" onClick={() => openFAQ(null)}>Tạo câu hỏi</DsButton>
      </DsToolbar>
      {faqsQuery.isLoading ? (
        <p className="ds-hint" style={{ padding: 16 }}>Đang tải...</p>
      ) : faqs.length ? (
        <div role="listbox" aria-label="Danh sách câu hỏi thường gặp">
          {faqs.map((faq) => (
            <button key={faq.id} type="button" role="option" className="ds-listrow" aria-selected={pane?.kind === "faq" && pane.faq?.id === faq.id} onClick={() => openFAQ(faq)}>
              <span className="ds-listrow__main">
                <strong>{faq.question}</strong>
                <small>{faqCategoryLabels[faq.category || ""] || faq.category || "Chưa phân nhóm"} · {faq.showOnWeb ? "Hiện trên web" : "Ẩn trên web"} · {faq.useInChatbot ? "Dùng cho trợ lý" : "Không dùng cho trợ lý"}</small>
              </span>
              <DsStatusPill tone={faq.isActive ? "good" : "neutral"}>{faq.isActive ? "Đang bật" : "Đang tắt"}</DsStatusPill>
            </button>
          ))}
        </div>
      ) : (
        <DsEmptyState title="Chưa có câu hỏi phù hợp" />
      )}
    </DsPanel>
  );

  const faqPane =
    pane?.kind === "faq" ? (
      <DsPane
        title={pane.faq ? "Sửa câu hỏi" : "Tạo câu hỏi"}
        badge={pane.faq ? <DsStatusPill tone={pane.faq.isActive ? "good" : "neutral"}>{pane.faq.isActive ? "Đang bật" : "Đang tắt"}</DsStatusPill> : undefined}
        onClose={closePane}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <p className="ds-hint" style={{ margin: 0 }}>Một nguồn câu hỏi cho trang Hỏi đáp và trợ lý ảo.</p>
          <DsField label="Câu hỏi" htmlFor="faq-question" required>
            <DsTextarea id="faq-question" rows={2} value={faqForm.question} onChange={(event) => setFAQForm((current) => ({ ...current, question: event.target.value }))} />
          </DsField>
          <DsField label="Câu trả lời" htmlFor="faq-answer" required>
            <DsTextarea id="faq-answer" rows={5} value={faqForm.answer} onChange={(event) => setFAQForm((current) => ({ ...current, answer: event.target.value }))} />
          </DsField>
          <div className="ds-grid-fields">
            <DsField label="Nhóm" htmlFor="faq-category">
              <DsSelect id="faq-category" value={faqForm.category} onChange={(event) => setFAQForm((current) => ({ ...current, category: event.target.value }))}>
                <option value="">Chưa phân nhóm</option>
                {Object.entries(faqCategoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </DsSelect>
            </DsField>
            <DsField label="Thứ tự" hint="Số nhỏ hiển thị trước">
              <NumberStepper label="Thứ tự hiển thị" value={Number(faqForm.order || 0)} min={0} max={999} onChange={(value) => setFAQForm((current) => ({ ...current, order: String(value) }))} />
            </DsField>
          </div>
          <DsField label="Từ khóa" htmlFor="faq-keywords" hint="Cách nhau bằng dấu phẩy; giúp trợ lý ảo tìm đúng câu hỏi">
            <DsInput id="faq-keywords" value={faqForm.keywords} onChange={(event) => setFAQForm((current) => ({ ...current, keywords: event.target.value }))} />
          </DsField>
          <Check id="faq-web" checked={faqForm.showOnWeb} onChange={(showOnWeb) => setFAQForm((current) => ({ ...current, showOnWeb }))} label="Hiện trên trang Hỏi đáp" />
          <Check id="faq-bot" checked={faqForm.useInChatbot} onChange={(useInChatbot) => setFAQForm((current) => ({ ...current, useInChatbot }))} label="Dùng cho trợ lý ảo" />
          <Check id="faq-active" checked={faqForm.isActive} onChange={(isActive) => setFAQForm((current) => ({ ...current, isActive }))} label="Đang bật" />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {pane.faq ? (
              <>
                <DsButton onClick={() => void toggleFAQ(pane.faq as DashboardFAQ)}>{pane.faq.isActive ? "Tắt ngay" : "Bật ngay"}</DsButton>
                {canWrite ? <DsButton variant="ghost" onClick={() => setConfirmDelete(true)}>Xoá</DsButton> : null}
              </>
            ) : null}
            <DsButton onClick={closePane}>Đóng</DsButton>
            <DsButton variant="primary" disabled={saving || !faqForm.question.trim() || !faqForm.answer.trim()} onClick={() => void saveFAQ()}>
              {saving ? "Đang lưu..." : pane.faq ? "Lưu thay đổi" : "Tạo câu hỏi"}
            </DsButton>
          </div>
          {confirmDelete && pane.faq ? (
            <DsNotice tone="bad">
              <div style={{ display: "grid", gap: 8 }}>
                <span>Xoá câu hỏi này? Không hoàn tác được.</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <DsButton variant="danger" disabled={saving} onClick={() => void deleteFAQ()}>Xoá câu hỏi</DsButton>
                  <DsButton onClick={() => setConfirmDelete(false)}>Giữ lại</DsButton>
                </div>
              </div>
            </DsNotice>
          ) : null}
        </div>
      </DsPane>
    ) : null;

  return (
    <>
      <DsPageHeader title="Cài đặt trang" description="Thông tin công khai, bố cục trang chủ, ảnh quảng bá và câu hỏi thường gặp trên trang người dùng." />
      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        {error || queryError ? <DsNotice tone="bad">{error || queryError}</DsNotice> : null}
        {notice ? <DsNotice tone="good">{notice}</DsNotice> : null}
        {tabBar}
      </div>
      {activeTab === "settings" ? settingsTab : null}
      {activeTab === "home" ? homeTab : null}
      {activeTab === "banners" ? <DsSplit list={bannerList} pane={bannerPane} /> : null}
      {activeTab === "faqs" ? <DsSplit list={faqList} pane={faqPane} /> : null}
    </>
  );
}
