import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Supporting documents are posted through server actions. The host takes
  // 4.5 MB a request; documents are held to 4 MB (see documents.ts).
  experimental: { serverActions: { bodySizeLimit: "4.5mb" } },
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
