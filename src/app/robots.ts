import type { MetadataRoute } from "next";
import { SITE_URL } from "./site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Everything behind a login. These already redirect or 404 for a
      // crawler, so nothing leaks either way — but a school's books have no
      // business in a search index, and crawling them is wasted budget that
      // would otherwise go on the pages meant to be found.
      disallow: ["/app/", "/admin/", "/api/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
