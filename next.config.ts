import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Product/proof images are served from Route Handlers as raw bytes /
    // data URLs; the original app used plain <img> tags everywhere.
    unoptimized: true,
  },
};

export default nextConfig;
