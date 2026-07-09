import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "@/components/providers";
import { serverApiRequest } from "@/lib/server-api";
import type { SiteSettingsValue } from "@/lib/types";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const defaultTitle = "Hospital Booking";
const defaultDescription =
  "Đặt lịch khám bệnh trực tuyến, tra cứu lịch hẹn, theo dõi hóa đơn và kết quả khám.";

async function getSiteSettings() {
  try {
    return await serverApiRequest<SiteSettingsValue>("/site-settings", {
      next: { revalidate: 60 },
    });
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const hospitalName = settings?.hospitalName?.trim() || defaultTitle;
  const favicon = settings?.favicon?.trim() || "/favicon.ico";
  const logo = settings?.logo?.trim();

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: hospitalName,
      template: `%s | ${hospitalName}`,
    },
    description: defaultDescription,
    applicationName: hospitalName,
    keywords: [
      "đặt lịch khám bệnh",
      "đặt lịch bác sĩ",
      "khám bệnh trực tuyến",
      "tra cứu lịch hẹn",
      "gói khám",
      "chuyên khoa",
    ],
    authors: [{ name: hospitalName }],
    creator: hospitalName,
    publisher: hospitalName,
    alternates: {
      canonical: "/",
    },
    openGraph: {
      type: "website",
      locale: "vi_VN",
      siteName: hospitalName,
      title: hospitalName,
      description: defaultDescription,
      url: "/",
      images: logo ? [{ url: logo, alt: hospitalName }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: hospitalName,
      description: defaultDescription,
      images: logo ? [logo] : undefined,
    },
    icons: {
      icon: favicon,
      shortcut: favicon,
      apple: favicon,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
      </head>
      <body>
        <Providers>{children}</Providers>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
