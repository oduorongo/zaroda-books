import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // /privacy and /terms read better than /legal/privacy, but the two pages
  // share a layout, so they live together and are served at the short paths.
  async rewrites() {
    return [
      { source: "/privacy", destination: "/legal/privacy" },
      { source: "/terms", destination: "/legal/terms" },
    ];
  },
};

export default nextConfig;
