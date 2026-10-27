import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/departments", "/bac-si", "/packages", "/faqs", "/guide/booking"],
        disallow: [
          "/dashboard",
          "/dashboard/",
          "/login",
          "/appointments/lookup",
          "/search",
          "/payment",
          "/payment/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
