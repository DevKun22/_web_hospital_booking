import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
  async redirects() {
    return [
      {
        source: "/departments",
        destination: "/chuyen-khoa",
        permanent: true,
      },
      {
        source: "/departments/:slug",
        destination: "/chuyen-khoa/:slug",
        permanent: true,
      },
      {
        source: "/doctors",
        destination: "/bac-si",
        permanent: true,
      },
      {
        source: "/doctors/:slug",
        destination: "/bac-si/:slug",
        permanent: true,
      },
      {
        source: "/packages",
        destination: "/goi-kham",
        permanent: true,
      },
      {
        source: "/packages/:slug",
        destination: "/goi-kham/:slug",
        permanent: true,
      },
      {
        source: "/faqs",
        destination: "/hoi-dap",
        permanent: true,
      },
      {
        source: "/guide/booking",
        destination: "/huong-dan/dat-lich",
        permanent: true,
      },
      {
        source: "/appointments/lookup",
        destination: "/tai-khoan/dang-nhap?next=/tai-khoan/lich-hen",
        permanent: true,
      },
      {
        source: "/tra-cuu-lich-hen",
        destination: "/tai-khoan/dang-nhap?next=/tai-khoan/lich-hen",
        permanent: true,
      },
      {
        source: "/search",
        destination: "/tim-kiem",
        permanent: true,
      },
      {
        source: "/payment/return",
        destination: "/thanh-toan/ket-qua",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
