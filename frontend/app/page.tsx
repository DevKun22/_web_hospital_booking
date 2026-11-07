import { PublicHomeClient } from "@/components/public/public-home-client";
import { emptyHomeData, type PublicHomeData } from "@/components/public/public-home-types";
import { serverApiRequest } from "@/lib/server-api";
import { absoluteUrl, buildOpenGraph, jsonLdString } from "@/lib/seo";
import type { Banner, DoctorProfile, HomePageConfigValue, MedicalPackage, PublicFAQ, SiteSettingsValue } from "@/lib/types";
import type { Metadata } from "next";

export const revalidate = 60;

export const metadata: Metadata = {
  ...buildOpenGraph({
  title: "Đặt lịch khám trực tuyến",
  description: "Đặt lịch khám, chọn chuyên khoa, bác sĩ, gói khám và tra cứu lịch hẹn trực tuyến.",
  path: "/",
  keywords: ["đặt lịch khám", "đặt lịch bác sĩ", "gói khám", "tra cứu lịch hẹn"],
  }),
  verification: {
    google:
      process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ||
      "j_aO8IuKTc90WaB5XcpNQsVXAPIsEHC34mUgaeRoMAA",
  },
};

type PublicBootstrapData = {
  siteSettings: SiteSettingsValue | null;
  homeConfig: HomePageConfigValue | null;
  banners: Banner[];
  departments: PublicHomeData["departments"];
  doctors: DoctorProfile[];
  packages: MedicalPackage[];
  faqs: PublicFAQ[];
};

async function getHomeData(): Promise<{ data: PublicHomeData; error: string }> {
  try {
    const bootstrap = await serverApiRequest<PublicBootstrapData>(
      "/public/bootstrap",
      {
        query: { view: "featured" },
        next: { revalidate: 60 },
      },
    );
    const publicBanners = bootstrap.banners || [];
    const heroBanners = publicBanners.filter((banner) => banner.position === "HOME_HERO");

    return {
      data: {
        settings: bootstrap.siteSettings,
        homeConfig: bootstrap.homeConfig,
        heroBanners,
        promoBanners: [],
        partnerBanners: publicBanners.filter((banner) => banner.position === "HOME_PARTNER"),
        departments: bootstrap.departments,
        doctors: bootstrap.doctors,
        packages: bootstrap.packages,
        faqs: bootstrap.faqs,
      },
      error: "",
    };
  } catch (err) {
    return {
      data: emptyHomeData,
      error: err instanceof Error ? err.message : "Không tải được dữ liệu website",
    };
  }
}

function buildMedicalOrganizationJsonLd(data: PublicHomeData) {
  const settings = data.settings;
  const hospitalName = settings?.hospitalName || "Hospital Booking";
  const socialLinks = settings?.socialLinks ? Object.values(settings.socialLinks).filter(Boolean) : [];

  return {
    "@context": "https://schema.org",
    "@type": "MedicalOrganization",
    "@id": absoluteUrl("/#organization"),
    name: hospitalName,
    url: absoluteUrl("/"),
    logo: absoluteUrl(settings?.logo),
    telephone: settings?.hotline || settings?.emergencyHotline || undefined,
    email: settings?.email || undefined,
    address: settings?.address
      ? {
        "@type": "PostalAddress",
        streetAddress: settings.address,
        addressCountry: "VN",
      }
      : undefined,
    sameAs: socialLinks.length ? socialLinks : undefined,
    medicalSpecialty: data.departments.slice(0, 12).map((item) => item.name),
  };
}

function buildWebSiteJsonLd(data: PublicHomeData) {
  const hospitalName = data.settings?.hospitalName || "Hospital Booking";

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absoluteUrl("/#website"),
    name: hospitalName,
    url: absoluteUrl("/"),
    inLanguage: "vi-VN",
    publisher: {
      "@id": absoluteUrl("/#organization"),
    },
  };
}

export default async function PublicHomePage() {
  const { data, error } = await getHomeData();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(buildMedicalOrganizationJsonLd(data)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(buildWebSiteJsonLd(data)) }}
      />
      <PublicHomeClient data={data} error={error} />
    </>
  );
}
