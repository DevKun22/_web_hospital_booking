import type { Banner, DashboardFAQ, HomePageConfigValue, SiteSettingsValue } from "@/lib/types";
import { toVietnamDateTimeInput } from "@/lib/date";

// Cài đặt trang: kiểu biểu mẫu, giá trị mặc định và chuyển đổi dữ liệu tách khỏi trang.

export type TabKey = "home" | "settings" | "banners" | "faqs";

export type SiteForm = SiteSettingsValue & {
  logoAssetId: string;
  faviconAssetId: string;
  facebook: string;
  zalo: string;
  youtube: string;
  tiktok: string;
};

export type BannerForm = {
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

export type FAQForm = {
  question: string;
  answer: string;
  category: string;
  order: string;
  keywords: string;
  showOnWeb: boolean;
  useInChatbot: boolean;
  isActive: boolean;
};

export type Pane =
  | { kind: "banner"; banner: Banner | null }
  | { kind: "faq"; faq: DashboardFAQ | null }
  | null;

export const tabs: { id: TabKey; label: string }[] = [
  { id: "settings", label: "Thông tin trang" },
  { id: "home", label: "Bố cục trang chủ" },
  { id: "banners", label: "Ảnh quảng bá" },
  { id: "faqs", label: "Câu hỏi thường gặp" },
];

export const emptyHomePageForm: HomePageConfigValue = {
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

export const configurableHomeSections: Array<{
  key: "departments" | "doctors" | "packages" | "partners";
  label: string;
}> = [
  { key: "departments", label: "Chuyên khoa" },
  { key: "doctors", label: "Bác sĩ" },
  { key: "packages", label: "Gói khám" },
  { key: "partners", label: "Đối tác" },
];

export const emptySiteForm: SiteForm = {
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

export const emptyBannerForm: BannerForm = {
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

export const emptyFAQForm: FAQForm = {
  question: "",
  answer: "",
  category: "booking",
  order: "0",
  keywords: "",
  showOnWeb: true,
  useInChatbot: true,
  isActive: true,
};

export const positionLabels: Record<string, string> = {
  HOME_HERO: "Ảnh lớn đầu trang chủ",
  HOME_PARTNER: "Dải đối tác",
};
export const faqCategoryLabels: Record<string, string> = {
  booking: "Đặt lịch",
  payment: "Thanh toán",
  doctor: "Bác sĩ",
  insurance: "Bảo hiểm",
  general: "Chung",
};

export const toNullable = (value: string) => value.trim() || null;

export const toSiteForm = (settings?: SiteSettingsValue): SiteForm => {
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

export const toBannerForm = (banner: Banner): BannerForm => ({
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

export const toFAQForm = (faq: DashboardFAQ): FAQForm => ({
  question: faq.question,
  answer: faq.answer,
  category: faq.category || "",
  order: String(faq.order),
  keywords: faq.keywords.join(", "),
  showOnWeb: faq.showOnWeb,
  useInChatbot: faq.useInChatbot,
  isActive: faq.isActive,
});

export const parseKeywords = (value: string) =>
  Array.from(new Set(value.split(",").map((item) => item.trim()).filter(Boolean)));
