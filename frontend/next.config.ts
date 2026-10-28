import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/doctors",
        destination: "/bac-si",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
