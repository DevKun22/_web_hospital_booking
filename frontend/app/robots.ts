import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/chuyen-khoa", "/bac-si", "/goi-kham", "/hoi-dap", "/huong-dan/dat-lich"],
        disallow: [
          "/dashboard",
          "/dashboard/",
          "/login",
          "/tra-cuu-lich-hen",
          "/tim-kiem",
          "/thanh-toan",
          "/thanh-toan/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
