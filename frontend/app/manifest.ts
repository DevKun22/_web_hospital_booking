import type { MetadataRoute } from "next";
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND_NAME} - ${BRAND_TAGLINE}`,
    short_name: BRAND_NAME,
    description: "Đặt lịch khám bệnh trực tuyến, tra cứu lịch hẹn, hóa đơn và kết quả khám.",
    lang: "vi",
    start_url: "/",
    display: "standalone",
    background_color: "#f2fafc",
    theme_color: "#07549c",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
