import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Supporting documents are posted through server actions. The host takes
  // 4.5 MB a request; documents are held to 4 MB (see documents.ts).
  experimental: { serverActions: { bodySizeLimit: "4.5mb" } },
  // No page may be framed by another site: the head's authorise page would
  // otherwise be clickable through a disguise. nosniff keeps an uploaded
  // "photo" from being run as anything else; the referrer policy keeps
  // emailed links' tokens from leaving with a click to another site.
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    }];
  },
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
