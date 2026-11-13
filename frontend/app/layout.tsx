import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "@/components/providers";
import { TooltipProvider } from "@/components/ui/tooltip";
import { serverApiRequest } from "@/lib/server-api";
import { SITE_URL } from "@/lib/seo";
import type { SiteSettingsValue } from "@/lib/types";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "./globals.css";

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
    metadataBase: new URL(SITE_URL),
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
    openGraph: {
      type: "website",
      locale: "vi_VN",
      siteName: hospitalName,
      title: hospitalName,
      description: defaultDescription,
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
    category: "health",
    referrer: "origin-when-cross-origin",
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
};

const themeInitializationScript = `
  (() => {
    try {
      const stored = localStorage.getItem("hospital-web-theme");
      const theme = stored === "light" || stored === "dark"
        ? stored
        : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      const root = document.documentElement;
      root.dataset.theme = theme;
      root.classList.add(theme === "dark" ? "theme-dark" : "theme-light");
      root.style.colorScheme = theme;
    } catch {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <Script
          id="theme-initialization"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitializationScript }}
        />
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
      </head>
      <body>
        <Providers>
          <TooltipProvider>{children}</TooltipProvider>
        </Providers>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
