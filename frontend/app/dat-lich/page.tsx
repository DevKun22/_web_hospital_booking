import { PublicBookingPageClient } from "@/components/public/public-booking-page-client";
import { emptyHomeData, type PublicHomeData } from "@/components/public/public-home-types";
import { serverApiRequest } from "@/lib/server-api";
import type { Banner, DoctorProfile, HomePageConfigValue, MedicalPackage, PublicFAQ, SiteSettingsValue } from "@/lib/types";

export const revalidate = 300;

type PublicBootstrapData = {
  siteSettings: SiteSettingsValue | null;
  homeConfig: HomePageConfigValue | null;
  banners: Banner[];
  departments: PublicHomeData["departments"];
  doctors: DoctorProfile[];
  packages: MedicalPackage[];
  faqs: PublicFAQ[];
};

async function getBookingData(): Promise<{ data: PublicHomeData; error: string }> {
  try {
    const bootstrap = await serverApiRequest<PublicBootstrapData>("/public/bootstrap", {
      query: { view: "full" },
    });
    const banners = bootstrap.banners || [];

    return {
      data: {
        settings: bootstrap.siteSettings,
        homeConfig: bootstrap.homeConfig || null,
        heroBanners: banners.filter((banner) => banner.position === "HOME_HERO"),
        promoBanners: banners.filter((banner) => banner.position === "HOME_PROMO"),
        partnerBanners: [],
        departments: bootstrap.departments,
        doctors: bootstrap.doctors,
        packages: bootstrap.packages,
        faqs: bootstrap.faqs,
      },
      error: "",
    };
  } catch (error) {
    return {
      data: emptyHomeData,
      error: error instanceof Error ? error.message : "Không tải được dữ liệu đặt lịch",
    };
  }
}

export default async function BookingPage() {
  const { data, error } = await getBookingData();
  return <PublicBookingPageClient data={data} error={error} />;
}
