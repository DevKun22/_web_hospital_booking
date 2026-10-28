"use client";

/* eslint-disable @next/next/no-img-element */

import { useQueryClient } from "@tanstack/react-query";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { DashboardFeedback } from "@/components/dashboard/dashboard-feedback";
import { DashboardWorkspace } from "@/components/dashboard/dashboard-workspace";
import {
  DashboardPageHeader,
  DashboardStatusBadge,
  DashboardSurface,
} from "@/components/dashboard/dashboard-ui";
import { apiRequest, uploadImages } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useDashboardBanners, useDashboardFAQs, useDashboardSiteSettings } from "@/lib/dashboard-site-settings-query";
import { formatVietnamDateTime, fromVietnamDateTimeInput, toVietnamDateTimeInput } from "@/lib/date";
import { queryKeys } from "@/lib/query-keys";
import type { Banner, MediaAsset, PublicFAQ, SiteSettingsRecord, SiteSettingsValue } from "@/lib/types";

type TabKey = "settings" | "banners" | "faqs";

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
  isActive: boolean;
};

const tabs: { key: TabKey; label: string }[] = [
  { key: "settings", label: "Thông tin trang người dùng" },
  { key: "banners", label: "Ảnh quảng bá" },
  { key: "faqs", label: "Câu hỏi thường gặp" },
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
  isActive: true,
};

const positionOptions = ["HOME_HERO", "HOME_PROMO", "HOME_DEPARTMENT", "FOOTER"];
const faqCategories = ["booking", "payment", "doctor", "insurance", "general"];

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

const toFAQForm = (faq: PublicFAQ): FAQForm => ({
  question: faq.question,
  answer: faq.answer,
  category: faq.category || "",
  order: String(faq.order),
  isActive: faq.isActive,
});

export default function SiteSettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canWrite = user?.role === "ADMIN";
  const canManage = user?.role === "ADMIN" || user?.role === "STAFF";
  const [activeTab, setActiveTab] = useState<TabKey>("settings");
  const [siteForm, setSiteForm] = useState<SiteForm>(emptySiteForm);
  const [bannerForm, setBannerForm] = useState<BannerForm>(emptyBannerForm);
  const [bannerWorkspaceOpen, setBannerWorkspaceOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [deleteBanner, setDeleteBanner] = useState<Banner | null>(null);
  const [bannerPosition, setBannerPosition] = useState("");
  const [appliedBannerPosition, setAppliedBannerPosition] = useState("");
  const [bannerActive, setBannerActive] = useState("");
  const [faqForm, setFAQForm] = useState<FAQForm>(emptyFAQForm);
  const [faqWorkspaceOpen, setFAQWorkspaceOpen] = useState(false);
  const [editingFAQ, setEditingFAQ] = useState<PublicFAQ | null>(null);
  const [deleteFAQ, setDeleteFAQ] = useState<PublicFAQ | null>(null);
  const [faqCategory, setFAQCategory] = useState("");
  const [appliedFAQCategory, setAppliedFAQCategory] = useState("");
  const [faqActive, setFAQActive] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const bannerListRef = useRef<HTMLElement | null>(null);
  const bannerFormRef = useRef<HTMLDivElement | null>(null);
  const faqListRef = useRef<HTMLElement | null>(null);
  const faqFormRef = useRef<HTMLDivElement | null>(null);
  const siteFormInitializedRef = useRef(false);

  const bannerQuery = useMemo(
    () => ({
      position: appliedBannerPosition || undefined,
      isActive: bannerActive || undefined,
    }),
    [appliedBannerPosition, bannerActive],
  );

  const faqQuery = useMemo(
    () => ({
      category: appliedFAQCategory || undefined,
      isActive: faqActive || undefined,
    }),
    [appliedFAQCategory, faqActive],
  );
  const siteSettingsQuery = useDashboardSiteSettings(canManage && activeTab === "settings");
  const bannersQuery = useDashboardBanners(bannerQuery, canManage && activeTab === "banners");
  const faqsQuery = useDashboardFAQs(faqQuery, canManage && activeTab === "faqs");
  const siteRecord = siteSettingsQuery.data;
  const banners = bannersQuery.data ?? [];
  const faqs = faqsQuery.data ?? [];
  const loading = activeTab === "settings"
    ? siteSettingsQuery.isLoading
    : activeTab === "banners"
      ? bannersQuery.isLoading
      : faqsQuery.isLoading;
  const queryFailure = siteSettingsQuery.error || bannersQuery.error || faqsQuery.error;
  const queryError = queryFailure instanceof Error
    ? queryFailure.message
    : queryFailure
      ? "Không tải được cấu hình trang người dùng"
      : "";

  const scrollTo = (ref: React.RefObject<HTMLElement | null>) => {
    window.setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };

  const invalidateSiteSettings = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardSiteSettings }),
      queryClient.invalidateQueries({ queryKey: queryKeys.publicSiteSettings }),
      queryClient.invalidateQueries({ queryKey: queryKeys.publicHome }),
    ]);
  };

  const invalidateBanners = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard", "banners"] }),
      queryClient.invalidateQueries({ queryKey: ["public", "banners"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.publicHome }),
    ]);
  };

  const invalidateFAQs = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["dashboard", "faqs"] }),
      queryClient.invalidateQueries({ queryKey: ["public", "faqs"] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.publicHome }),
    ]);
  };

  useEffect(() => {
    if (!siteSettingsQuery.data || siteFormInitializedRef.current) return;
    const timeoutId = window.setTimeout(() => {
      if (!siteSettingsQuery.data) return;
      siteFormInitializedRef.current = true;
      setSiteForm(toSiteForm(siteSettingsQuery.data.value));
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [siteSettingsQuery.data]);

  useEffect(() => {
    if (!notice && !error) return;
    const timeoutId = window.setTimeout(() => {
      setNotice("");
      setError("");
    }, 4500);
    return () => window.clearTimeout(timeoutId);
  }, [error, notice]);

  const uploadToForm = async (
    file: File | undefined,
    folder: string,
    key: string,
    setter: (asset: MediaAsset) => void,
  ) => {
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

  const saveSiteSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
      const payload: Partial<SiteSettingsValue> & {
        logoAssetId?: string;
        faviconAssetId?: string;
      } = {
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
      const updated = await apiRequest<SiteSettingsRecord>("/dashboard/site-settings", {
        method: "PATCH",
        body: payload,
      });
      queryClient.setQueryData(queryKeys.dashboardSiteSettings, updated);
      setSiteForm(toSiteForm(updated.value));
      await invalidateSiteSettings();
      setNotice("Đã cập nhật thông tin trang người dùng");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được thông tin trang người dùng");
    } finally {
      setSaving(false);
    }
  };

  const startCreateBanner = () => {
    setBannerWorkspaceOpen(true);
    setEditingBanner(null);
    setDeleteBanner(null);
    setBannerForm(emptyBannerForm);
    setActiveTab("banners");
    scrollTo(bannerFormRef);
  };

  const startEditBanner = (banner: Banner) => {
    setBannerWorkspaceOpen(true);
    setEditingBanner(banner);
    setDeleteBanner(null);
    setBannerForm(toBannerForm(banner));
    setActiveTab("banners");
    scrollTo(bannerFormRef);
  };

  const saveBanner = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) return;
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
      if (editingBanner) {
        await apiRequest<Banner>(`/dashboard/banners/${editingBanner.id}`, {
          method: "PATCH",
          body,
        });
        setNotice("Đã cập nhật ảnh quảng bá");
      } else {
        await apiRequest<Banner>("/dashboard/banners", {
          method: "POST",
          body,
        });
        setNotice("Đã tạo ảnh quảng bá");
      }
      setEditingBanner(null);
      setBannerForm(emptyBannerForm);
      await invalidateBanners();
      scrollTo(bannerListRef);
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
      await apiRequest<Banner>(`/dashboard/banners/${banner.id}`, {
        method: "PATCH",
        body: { isActive: !banner.isActive },
      });
      setNotice(banner.isActive ? "Đã tắt ảnh quảng bá" : "Đã bật ảnh quảng bá");
      await invalidateBanners();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được ảnh quảng bá");
    }
  };

  const confirmDeleteBanner = async () => {
    if (!canWrite || !deleteBanner) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await apiRequest<Banner>(`/dashboard/banners/${deleteBanner.id}`, { method: "DELETE" });
      setDeleteBanner(null);
      setNotice("Đã xoá ảnh quảng bá");
      await invalidateBanners();
      scrollTo(bannerListRef);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xoá được ảnh quảng bá");
    } finally {
      setSaving(false);
    }
  };

  const startCreateFAQ = () => {
    setFAQWorkspaceOpen(true);
    setEditingFAQ(null);
    setDeleteFAQ(null);
    setFAQForm(emptyFAQForm);
    setActiveTab("faqs");
    scrollTo(faqFormRef);
  };

  const startEditFAQ = (faq: PublicFAQ) => {
    setFAQWorkspaceOpen(true);
    setEditingFAQ(faq);
    setDeleteFAQ(null);
    setFAQForm(toFAQForm(faq));
    setActiveTab("faqs");
    scrollTo(faqFormRef);
  };

  const saveFAQ = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const body = {
        question: faqForm.question.trim(),
        answer: faqForm.answer.trim(),
        category: toNullable(faqForm.category),
        order: Number(faqForm.order || 0),
        isActive: faqForm.isActive,
      };
      if (editingFAQ) {
        await apiRequest<PublicFAQ>(`/dashboard/faqs/${editingFAQ.id}`, {
          method: "PATCH",
          body,
        });
        setNotice("Đã cập nhật câu hỏi thường gặp");
      } else {
        await apiRequest<PublicFAQ>("/dashboard/faqs", {
          method: "POST",
          body,
        });
        setNotice("Đã tạo câu hỏi thường gặp");
      }
      setEditingFAQ(null);
      setFAQForm(emptyFAQForm);
      await invalidateFAQs();
      scrollTo(faqListRef);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được câu hỏi thường gặp");
    } finally {
      setSaving(false);
    }
  };

  const toggleFAQ = async (faq: PublicFAQ) => {
    if (!canManage) return;
    setError("");
    setNotice("");
    try {
      await apiRequest<PublicFAQ>(`/dashboard/faqs/${faq.id}`, {
        method: "PATCH",
        body: { isActive: !faq.isActive },
      });
      setNotice(faq.isActive ? "Đã tắt câu hỏi" : "Đã bật câu hỏi");
      await invalidateFAQs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được câu hỏi");
    }
  };

  const confirmDeleteFAQ = async () => {
    if (!canWrite || !deleteFAQ) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await apiRequest<PublicFAQ>(`/dashboard/faqs/${deleteFAQ.id}`, { method: "DELETE" });
      setDeleteFAQ(null);
      setNotice("Đã xoá câu hỏi thường gặp");
      await invalidateFAQs();
      scrollTo(faqListRef);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xoá được câu hỏi thường gặp");
    } finally {
      setSaving(false);
    }
  };

  if (!canManage) {
    return (
      <DashboardPageHeader eyebrow="Trang người dùng" title="Cấu hình trang người dùng" description="Phân hệ này chỉ dành cho quản trị viên hoặc nhân viên tiếp nhận." />
    );
  }

  return (
    <div className="space-y-6">
      <DashboardFeedback error={error || queryError} notice={notice} onDismiss={() => { setError(""); setNotice(""); }} />

      <DashboardPageHeader
        eyebrow="Trang người dùng"
        title="Cấu hình trang người dùng"
        description="Quản lý thông tin công khai, ảnh quảng bá và câu hỏi thường gặp trên hệ thống đặt lịch."
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={startCreateBanner} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm font-medium text-[#42526b]">Tạo ảnh quảng bá</button>
            <button type="button" onClick={startCreateFAQ} className="rounded-md bg-[#0d4f8b] px-3 py-2 text-sm font-semibold text-white hover:bg-[#083d6d]">Tạo câu hỏi</button>
          </div>
        }
      />
      <DashboardSurface className="p-4">
        <div className="mt-5 flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-md border px-3 py-2 text-sm font-semibold ${activeTab === tab.key ? "border-[#0d4f8b] bg-[#e7f0fb] text-[#0d4f8b]" : "border-[#dce3ee] text-[#42526b] hover:bg-[#f8fafc]"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </DashboardSurface>

      {loading ? <section className="rounded-md border border-[#dce3ee] bg-white p-8 text-center text-sm text-[#667892]">Đang tải cấu hình trang người dùng...</section> : null}

      {activeTab === "settings" ? (
        <DashboardSurface className="p-5">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Thông tin trang người dùng</h3>
              <p className="mt-1 text-sm text-[#667892]">Nhân viên được xem, chỉ quản trị viên được cập nhật cấu hình hiển thị công khai.</p>
            </div>
            <p className="text-xs text-[#8a98aa]">Cập nhật {siteRecord?.updatedAt ? formatVietnamDateTime(siteRecord.updatedAt) : "-"}</p>
          </div>
          <form className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]" onSubmit={saveSiteSettings}>
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block"><span className="text-sm font-medium text-[#334155]">Tên bệnh viện</span><input disabled={!canWrite} value={siteForm.hospitalName || ""} onChange={(e) => setSiteForm((current) => ({ ...current, hospitalName: e.target.value }))} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f8fafc]" /></label>
                <label className="block"><span className="text-sm font-medium text-[#334155]">Email</span><input disabled={!canWrite} value={siteForm.email || ""} onChange={(e) => setSiteForm((current) => ({ ...current, email: e.target.value }))} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f8fafc]" /></label>
                <label className="block"><span className="text-sm font-medium text-[#334155]">Hotline</span><input disabled={!canWrite} value={siteForm.hotline || ""} onChange={(e) => setSiteForm((current) => ({ ...current, hotline: e.target.value }))} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f8fafc]" /></label>
                <label className="block"><span className="text-sm font-medium text-[#334155]">Hotline cấp cứu</span><input disabled={!canWrite} value={siteForm.emergencyHotline || ""} onChange={(e) => setSiteForm((current) => ({ ...current, emergencyHotline: e.target.value }))} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f8fafc]" /></label>
              </div>
              <label className="block"><span className="text-sm font-medium text-[#334155]">Địa chỉ</span><textarea disabled={!canWrite} value={siteForm.address || ""} onChange={(e) => setSiteForm((current) => ({ ...current, address: e.target.value }))} rows={2} className="mt-1 w-full resize-none rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f8fafc]" /></label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block"><span className="text-sm font-medium text-[#334155]">Giờ làm việc</span><textarea disabled={!canWrite} value={siteForm.workingHours || ""} onChange={(e) => setSiteForm((current) => ({ ...current, workingHours: e.target.value }))} rows={2} className="mt-1 w-full resize-none rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f8fafc]" /></label>
                <label className="block"><span className="text-sm font-medium text-[#334155]">Đường dẫn bản đồ</span><textarea disabled={!canWrite} value={siteForm.mapUrl || ""} onChange={(e) => setSiteForm((current) => ({ ...current, mapUrl: e.target.value }))} rows={2} className="mt-1 w-full resize-none rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f8fafc]" /></label>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                {(["facebook", "zalo", "youtube", "tiktok"] as const).map((key) => (
                  <label key={key} className="block"><span className="text-sm font-medium capitalize text-[#334155]">{key}</span><input disabled={!canWrite} value={siteForm[key]} onChange={(e) => setSiteForm((current) => ({ ...current, [key]: e.target.value }))} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f8fafc]" /></label>
                ))}
              </div>
              {canWrite ? <button disabled={saving || Boolean(uploading)} className="rounded-md bg-[#0d4f8b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#083d6d] disabled:opacity-60">{saving ? "Đang lưu..." : "Lưu thông tin"}</button> : null}
            </div>
            <aside className="space-y-4">
              {(["logo", "favicon"] as const).map((key) => (
                <div key={key} className="rounded-md border border-[#e5ebf3] p-3">
                  <label className="block"><span className="text-sm font-medium text-[#334155]">{key === "logo" ? "Logo" : "Favicon"}</span><input disabled={!canWrite} value={siteForm[key] || ""} onChange={(e) => setSiteForm((current) => ({ ...current, [key]: e.target.value, [`${key}AssetId`]: "" }))} placeholder="https://..." className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa] disabled:bg-[#f8fafc]" /></label>
                  <input disabled={!canWrite || uploading === key} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/x-icon,image/vnd.microsoft.icon,.ico" onChange={(e) => void uploadToForm(e.target.files?.[0], "site-settings", key, (asset) => setSiteForm((current) => ({ ...current, [key]: asset.url, [`${key}AssetId`]: asset.id })))} className="mt-2 w-full rounded-md border border-dashed border-[#cfd8e6] bg-[#f8fafc] px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#0d4f8b] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white disabled:opacity-60" />
                  {uploading === key ? <p role="status" className="mt-2 text-xs font-medium text-[#0d4f8b]">Đang tải ảnh lên...</p> : null}
                  {siteForm[key] ? <div className="mt-3 rounded-md border border-[#e5ebf3] p-2"><img src={siteForm[key] || ""} alt={`Xem trước ${key === "logo" ? "biểu trưng" : "biểu tượng trang"}`} className="h-28 w-full rounded-md object-contain" /><p className="mt-2 truncate text-xs text-[#667892]">{siteForm[key]}</p></div> : null}
                </div>
              ))}
            </aside>
          </form>
        </DashboardSurface>
      ) : null}

      {activeTab === "banners" ? (
        <div className={`grid gap-6 ${bannerWorkspaceOpen ? "xl:grid-cols-[minmax(0,1fr)_420px]" : "grid-cols-1"}`}>
          <section ref={bannerListRef} className="min-w-0 scroll-mt-24 rounded-md border border-[#dce3ee] bg-white">
            <form onSubmit={(event) => { event.preventDefault(); setAppliedBannerPosition(bannerPosition.trim()); }} className="grid gap-3 border-b border-[#e5ebf3] p-4 md:grid-cols-[1fr_180px_auto]">
              <input value={bannerPosition} onChange={(e) => setBannerPosition(e.target.value)} placeholder="Lọc theo mã vị trí hiển thị" list="banner-positions" className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" />
              <select value={bannerActive} onChange={(e) => setBannerActive(e.target.value)} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]"><option value="">Tất cả trạng thái</option><option value="true">Đang bật</option><option value="false">Đang tắt</option></select>
              <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold"><Search className="h-4 w-4" />Lọc</button>
            </form>
            <datalist id="banner-positions">{positionOptions.map((position) => <option key={position} value={position} />)}</datalist>
            <div className="divide-y divide-[#eef2f7]">
              {banners.length ? banners.map((banner) => (
                <article key={banner.id} className={`p-4 transition-colors ${editingBanner?.id === banner.id || deleteBanner?.id === banner.id ? "bg-[var(--primary-soft)]" : "hover:bg-[var(--surface-soft)]"}`}>
                  <div className="grid gap-4 lg:grid-cols-[180px_1fr_auto]">
                    <div className="overflow-hidden rounded-md border border-[#e5ebf3] bg-[#f8fafc]"><img src={banner.image} alt={banner.title} className="h-28 w-full object-cover" /></div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{banner.title}</h3><DashboardStatusBadge tone={banner.isActive ? "positive" : "neutral"}>{banner.isActive ? "Đang bật" : "Đang tắt"}</DashboardStatusBadge></div>
                      <p className="mt-1 text-sm text-[#667892]">{banner.subtitle || "Không có mô tả phụ"}</p>
                      <p className="mt-2 text-xs text-[#8a98aa]">{banner.position} - thứ tự {banner.order}</p>
                      <p className="mt-1 truncate text-xs text-[#8a98aa]">{banner.linkUrl || "Chưa có đường dẫn"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:justify-end">
                      <button type="button" onClick={() => startEditBanner(banner)} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b]">Sửa</button>
                      <button type="button" onClick={() => void toggleBanner(banner)} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b]">{banner.isActive ? "Tắt" : "Bật"}</button>
                      {canWrite ? <button type="button" onClick={() => { setBannerWorkspaceOpen(true); setDeleteBanner(banner); scrollTo(bannerFormRef); }} className="rounded-md border border-[#f2b8b5] px-3 py-1.5 text-xs font-medium text-[#b3261e]">Xoá</button> : null}
                    </div>
                  </div>
                </article>
              )) : <p className="p-8 text-center text-sm text-[#667892]">Chưa có ảnh quảng bá phù hợp.</p>}
            </div>
          </section>

          {bannerWorkspaceOpen ? <div ref={bannerFormRef} className="order-first scroll-mt-24 xl:order-none">
          <DashboardWorkspace open={bannerWorkspaceOpen} onOpenChange={setBannerWorkspaceOpen} title={deleteBanner ? "Xoá ảnh quảng bá" : editingBanner ? "Cập nhật ảnh quảng bá" : "Tạo ảnh quảng bá"} description="Kiểm soát nội dung, hình ảnh, vị trí và thời gian hiển thị trên trang người dùng.">
            {deleteBanner ? <div className="mb-5 rounded-md border border-[#f2b8b5] bg-[#fff3f2] p-4"><h3 className="font-semibold text-[#b3261e]">Xoá ảnh quảng bá?</h3><p className="mt-2 text-sm text-[#5f2630]">{deleteBanner.title}</p><div className="mt-3 flex gap-2"><button type="button" disabled={saving} onClick={() => void confirmDeleteBanner()} className="rounded-md bg-[#b3261e] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Xoá</button><button type="button" onClick={() => setDeleteBanner(null)} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm font-medium text-[#42526b]">Huỷ</button></div></div> : null}
            {!deleteBanner ? <form className="space-y-4" onSubmit={saveBanner}>
              <label className="block"><span className="text-sm font-medium text-[#334155]">Tiêu đề</span><input value={bannerForm.title} onChange={(e) => setBannerForm((current) => ({ ...current, title: e.target.value }))} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" required /></label>
              <label className="block"><span className="text-sm font-medium text-[#334155]">Mô tả phụ</span><textarea value={bannerForm.subtitle} onChange={(e) => setBannerForm((current) => ({ ...current, subtitle: e.target.value }))} rows={2} className="mt-1 w-full resize-none rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" /></label>
              {(["image", "mobileImage"] as const).map((key) => <div key={key}><label className="block"><span className="text-sm font-medium text-[#334155]">{key === "image" ? "Ảnh trên máy tính" : "Ảnh trên điện thoại"}</span><input value={bannerForm[key]} onChange={(e) => setBannerForm((current) => ({ ...current, [key]: e.target.value, [`${key}AssetId`]: "" }))} placeholder="https://..." className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" required={key === "image"} /></label><input disabled={uploading === key} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => void uploadToForm(e.target.files?.[0], "banners", key, (asset) => setBannerForm((current) => ({ ...current, [key]: asset.url, [`${key}AssetId`]: asset.id })))} className="mt-2 w-full rounded-md border border-dashed border-[#cfd8e6] bg-[#f8fafc] px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#0d4f8b] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-white disabled:opacity-60" />{uploading === key ? <p role="status" className="mt-2 text-xs font-medium text-[#0d4f8b]">Đang tải ảnh lên...</p> : null}{bannerForm[key] ? <div className="mt-2 rounded-md border border-[#e5ebf3] p-2"><img src={bannerForm[key]} alt={`Xem trước ảnh ${key === "image" ? "máy tính" : "điện thoại"}`} className="h-32 w-full rounded-md object-cover" /><p className="mt-2 truncate text-xs text-[#667892]">{bannerForm[key]}</p></div> : null}</div>)}
              <div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="text-sm font-medium text-[#334155]">Vị trí</span><input value={bannerForm.position} onChange={(e) => setBannerForm((current) => ({ ...current, position: e.target.value }))} list="banner-positions" className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" required /></label><label className="block"><span className="text-sm font-medium text-[#334155]">Thứ tự</span><input value={bannerForm.order} onChange={(e) => setBannerForm((current) => ({ ...current, order: e.target.value.replace(/\D/g, "") }))} inputMode="numeric" className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" /></label></div>
              <div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="text-sm font-medium text-[#334155]">Đường dẫn</span><input value={bannerForm.linkUrl} onChange={(e) => setBannerForm((current) => ({ ...current, linkUrl: e.target.value }))} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" /></label><label className="block"><span className="text-sm font-medium text-[#334155]">Cách mở</span><select value={bannerForm.target} onChange={(e) => setBannerForm((current) => ({ ...current, target: e.target.value }))} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]"><option value="_self">Mở trong trang hiện tại</option><option value="_blank">Mở trang mới</option></select></label></div>
              <div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="text-sm font-medium text-[#334155]">Bắt đầu</span><input type="datetime-local" value={bannerForm.startAt} onChange={(e) => setBannerForm((current) => ({ ...current, startAt: e.target.value }))} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" /></label><label className="block"><span className="text-sm font-medium text-[#334155]">Kết thúc</span><input type="datetime-local" value={bannerForm.endAt} onChange={(e) => setBannerForm((current) => ({ ...current, endAt: e.target.value }))} className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" /></label></div>
              <label className="flex items-center justify-between rounded-md border border-[#e5ebf3] px-3 py-2"><span className="text-sm font-medium text-[#334155]">Đang bật</span><input type="checkbox" checked={bannerForm.isActive} onChange={(e) => setBannerForm((current) => ({ ...current, isActive: e.target.checked }))} className="h-4 w-4 accent-[#0d4f8b]" /></label>
              <div className="flex gap-2"><button disabled={saving || Boolean(uploading)} className="flex-1 rounded-md bg-[#0d4f8b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#083d6d] disabled:opacity-60">{saving ? "Đang lưu..." : editingBanner ? "Lưu thay đổi" : "Tạo ảnh quảng bá"}</button>{editingBanner ? <button type="button" onClick={startCreateBanner} className="rounded-md border border-[#cfd8e6] px-4 py-2.5 text-sm font-medium text-[#42526b]">Huỷ</button> : null}</div>
            </form> : null}
          </DashboardWorkspace>
          </div> : null}
        </div>
      ) : null}

      {activeTab === "faqs" ? (
        <div className={`grid gap-6 ${faqWorkspaceOpen ? "xl:grid-cols-[minmax(0,1fr)_420px]" : "grid-cols-1"}`}>
          <section ref={faqListRef} className="min-w-0 scroll-mt-24 rounded-md border border-[#dce3ee] bg-white">
            <form onSubmit={(event) => { event.preventDefault(); setAppliedFAQCategory(faqCategory.trim()); }} className="grid gap-3 border-b border-[#e5ebf3] p-4 md:grid-cols-[1fr_180px_auto]"><input value={faqCategory} onChange={(e) => setFAQCategory(e.target.value)} placeholder="Lọc nhóm, ví dụ đặt lịch" list="faq-categories" className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" /><select value={faqActive} onChange={(e) => setFAQActive(e.target.value)} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]"><option value="">Tất cả trạng thái</option><option value="true">Đang bật</option><option value="false">Đang tắt</option></select><button type="submit" className="inline-flex items-center justify-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm font-semibold"><Search className="h-4 w-4" />Lọc</button></form>
            <datalist id="faq-categories">{faqCategories.map((category) => <option key={category} value={category} />)}</datalist>
            <div className="divide-y divide-[#eef2f7]">{faqs.length ? faqs.map((faq) => <article key={faq.id} className={`p-4 transition-colors ${editingFAQ?.id === faq.id || deleteFAQ?.id === faq.id ? "bg-[var(--primary-soft)]" : "hover:bg-[var(--surface-soft)]"}`}><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{faq.question}</h3><DashboardStatusBadge tone={faq.isActive ? "positive" : "neutral"}>{faq.isActive ? "Đang bật" : "Đang tắt"}</DashboardStatusBadge></div><p className="mt-2 text-sm text-[#667892]">{faq.answer}</p><p className="mt-2 text-xs text-[#8a98aa]">{faq.category || "chung"} - thứ tự {faq.order}</p></div><div className="flex flex-wrap gap-2 lg:justify-end"><button type="button" onClick={() => startEditFAQ(faq)} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b]">Sửa</button><button type="button" onClick={() => void toggleFAQ(faq)} className="rounded-md border border-[#cfd8e6] px-3 py-1.5 text-xs font-medium text-[#42526b]">{faq.isActive ? "Tắt" : "Bật"}</button>{canWrite ? <button type="button" onClick={() => { setFAQWorkspaceOpen(true); setDeleteFAQ(faq); scrollTo(faqFormRef); }} className="rounded-md border border-[#f2b8b5] px-3 py-1.5 text-xs font-medium text-[#b3261e]">Xoá</button> : null}</div></div></article>) : <p className="p-8 text-center text-sm text-[#667892]">Chưa có câu hỏi phù hợp.</p>}</div>
          </section>
          {faqWorkspaceOpen ? <div ref={faqFormRef} className="order-first scroll-mt-24 xl:order-none">
          <DashboardWorkspace open={faqWorkspaceOpen} onOpenChange={setFAQWorkspaceOpen} title={deleteFAQ ? "Xoá câu hỏi" : editingFAQ ? "Cập nhật câu hỏi" : "Tạo câu hỏi"} description="Nội dung hỗ trợ người dùng tự tìm câu trả lời trước khi liên hệ bệnh viện.">
            {deleteFAQ ? <div className="mb-5 rounded-md border border-[#f2b8b5] bg-[#fff3f2] p-4"><h3 className="font-semibold text-[#b3261e]">Xoá câu hỏi này?</h3><p className="mt-2 text-sm text-[#5f2630]">{deleteFAQ.question}</p><div className="mt-3 flex gap-2"><button type="button" disabled={saving} onClick={() => void confirmDeleteFAQ()} className="rounded-md bg-[#b3261e] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Xoá</button><button type="button" onClick={() => setDeleteFAQ(null)} className="rounded-md border border-[#cfd8e6] px-3 py-2 text-sm font-medium text-[#42526b]">Huỷ</button></div></div> : null}
            {!deleteFAQ ? <form className="space-y-4" onSubmit={saveFAQ}><label className="block"><span className="text-sm font-medium text-[#334155]">Câu hỏi</span><textarea value={faqForm.question} onChange={(e) => setFAQForm((current) => ({ ...current, question: e.target.value }))} rows={3} className="mt-1 w-full resize-none rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" required /></label><label className="block"><span className="text-sm font-medium text-[#334155]">Câu trả lời</span><textarea value={faqForm.answer} onChange={(e) => setFAQForm((current) => ({ ...current, answer: e.target.value }))} rows={5} className="mt-1 w-full resize-none rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" required /></label><div className="grid gap-3 sm:grid-cols-2"><label className="block"><span className="text-sm font-medium text-[#334155]">Nhóm nội dung</span><input value={faqForm.category} onChange={(e) => setFAQForm((current) => ({ ...current, category: e.target.value }))} list="faq-categories" className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" /></label><label className="block"><span className="text-sm font-medium text-[#334155]">Thứ tự</span><input value={faqForm.order} onChange={(e) => setFAQForm((current) => ({ ...current, order: e.target.value.replace(/\D/g, "") }))} inputMode="numeric" className="mt-1 w-full rounded-md border border-[#cfd8e6] px-3 py-2 text-sm outline-none focus:border-[#0d4f8b] focus:ring-2 focus:ring-[#cfe4fa]" /></label></div><label className="flex items-center justify-between rounded-md border border-[#e5ebf3] px-3 py-2"><span className="text-sm font-medium text-[#334155]">Đang bật</span><input type="checkbox" checked={faqForm.isActive} onChange={(e) => setFAQForm((current) => ({ ...current, isActive: e.target.checked }))} className="h-4 w-4 accent-[#0d4f8b]" /></label><div className="flex gap-2"><button disabled={saving} className="flex-1 rounded-md bg-[#0d4f8b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#083d6d] disabled:opacity-60">{saving ? "Đang lưu..." : editingFAQ ? "Lưu thay đổi" : "Tạo câu hỏi"}</button>{editingFAQ ? <button type="button" onClick={startCreateFAQ} className="rounded-md border border-[#cfd8e6] px-4 py-2.5 text-sm font-medium text-[#42526b]">Huỷ</button> : null}</div></form> : null}
          </DashboardWorkspace>
          </div> : null}
        </div>
      ) : null}
    </div>
  );
}
