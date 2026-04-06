import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pps.whatsapp.net",
      },
    ],
  },
};

export default nextConfig;
