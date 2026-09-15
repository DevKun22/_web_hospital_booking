import { PublicHomeClient } from "@/components/public/public-home-client";
import { emptyHomeData, type PublicHomeData } from "@/components/public/public-home-types";
import { serverApiRequest } from "@/lib/server-api";
import { absoluteUrl, jsonLdString } from "@/lib/seo";
import type { Banner, DoctorProfile, MedicalPackage, PublicFAQ, SiteSettingsValue } from "@/lib/types";
import type { Metadata } from "next";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Đặt lịch khám trực tuyến",
  description: "Đặt lịch khám, chọn chuyên khoa, bác sĩ, gói khám và tra cứu lịch hẹn trực tuyến.",
  alternates: {
    canonical: "/",
  },
  verification: {
    google: "j_aO8IuKTc90WaB5XcpNQsVXAPIsEHC34mUgaeRoMAA"
  }
};

async function getHomeData(): Promise<{ data: PublicHomeData; error: string }> {
  try {
    const [settings, banners, departments, doctors, packages, faqs] = await Promise.all([
      serverApiRequest<SiteSettingsValue>("/site-settings"),
      serverApiRequest<{ items: Banner[] }>("/banners"),
      serverApiRequest<PublicHomeData["departments"]>("/departments"),
      serverApiRequest<DoctorProfile[]>("/doctors"),
      serverApiRequest<MedicalPackage[]>("/packages"),
      serverApiRequest<{ items: PublicFAQ[] }>("/faqs"),
    ]);
    const publicBanners = banners.items || [];
    const heroPositions = new Set(["HOME_HERO", "HOME_PROMO", "HOME_DEPARTMENT"]);
    const heroBanners = publicBanners.filter((banner) => heroPositions.has(banner.position));
    const promoBanners = publicBanners.filter((banner) => banner.position === "HOME_PROMO");

    return {
      data: {
        settings,
        heroBanners: heroBanners.length ? heroBanners : publicBanners,
        promoBanners,
        departments,
        doctors,
        packages,
        faqs: faqs.items || [],
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

function buildHomeFAQJsonLd(data: PublicHomeData) {
  const faqs = data.faqs.slice(0, 10);
  if (!faqs.length) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export default async function PublicHomePage() {
  const { data, error } = await getHomeData();
  const faqJsonLd = buildHomeFAQJsonLd(data);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(buildMedicalOrganizationJsonLd(data)) }}
      />
      {faqJsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(faqJsonLd) }} />
      ) : null}
      <PublicHomeClient data={data} error={error} />
    </>
  );
}
