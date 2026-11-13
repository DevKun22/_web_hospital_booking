import { emptyHomeData, type PublicHomeData } from "@/components/public/public-home-types";
import type { Banner, DoctorProfile, HomePageConfigValue, MedicalPackage, PublicFAQ, SiteSettingsValue } from "@/lib/types";

// "featured": dữ liệu nổi bật cho trang chủ. "full": toàn bộ danh mục cho trang đặt lịch.
export type PublicBootstrapView = "featured" | "full";

// Phản hồi của GET /public/bootstrap.
export type PublicBootstrap = {
  siteSettings: SiteSettingsValue | null;
  homeConfig: HomePageConfigValue | null;
  banners: Banner[] | null;
  departments: PublicHomeData["departments"];
  doctors: DoctorProfile[];
  packages: MedicalPackage[];
  faqs: PublicFAQ[];
};

// Dữ liệu công khai kèm thời điểm máy chủ lấy được, để trình duyệt biết dữ liệu cũ hay mới.
export type PublicBootstrapSnapshot = {
  data: PublicHomeData;
  fetchedAt: number;
  error: string;
};

// Nơi duy nhất ghép phản hồi bootstrap thành dữ liệu cho giao diện.
export function toPublicHomeData(bootstrap: PublicBootstrap): PublicHomeData {
  const banners = bootstrap.banners || [];
  return {
    settings: bootstrap.siteSettings,
    homeConfig: bootstrap.homeConfig,
    heroBanners: banners.filter((banner) => banner.position === "HOME_HERO"),
    partnerBanners: banners.filter((banner) => banner.position === "HOME_PARTNER"),
    departments: bootstrap.departments,
    doctors: bootstrap.doctors,
    packages: bootstrap.packages,
    faqs: bootstrap.faqs,
  };
}

export const hasPublicHomeData = (data: PublicHomeData) =>
  Boolean(
    data.settings ||
      data.homeConfig ||
      data.heroBanners.length ||
      data.departments.length ||
      data.doctors.length ||
      data.packages.length ||
      data.faqs.length,
  );

export const emptySnapshot = (error: string): PublicBootstrapSnapshot => ({
  data: emptyHomeData,
  fetchedAt: 0,
  error,
});
