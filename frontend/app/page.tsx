import { PublicHomeClient } from "@/components/public/public-home-client";
import type { PublicHomeData } from "@/components/public/public-home-types";
import { loadPublicBootstrap } from "@/lib/public-bootstrap-server";
import { absoluteUrl, buildOpenGraph, jsonLdString } from "@/lib/seo";
import type { Metadata } from "next";

import { BRAND_NAME } from "@/lib/brand";
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

function buildMedicalOrganizationJsonLd(data: PublicHomeData) {
  const settings = data.settings;
  const hospitalName = settings?.hospitalName || BRAND_NAME;
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
  const hospitalName = data.settings?.hospitalName || BRAND_NAME;

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
  const snapshot = await loadPublicBootstrap("featured", 60);
  const { data } = snapshot;

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
      <PublicHomeClient snapshot={snapshot} />
    </>
  );
}
