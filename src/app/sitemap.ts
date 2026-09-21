import type { MetadataRoute } from "next";
import { SITE_URL } from "./site-url";

/**
 * Only pages that exist. /pricing is a section of the landing page, not a
 * route of its own, and listing it would offer search engines a 404.
 *
 * lastModified is the build time rather than the request time: telling a
 * crawler the page changed a second ago, on every crawl, is a claim that
 * stops being believed.
 */
const BUILT_AT = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, lastModified: BUILT_AT, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/signup`, lastModified: BUILT_AT, changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE_URL}/login`, lastModified: BUILT_AT, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified: BUILT_AT, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/terms`, lastModified: BUILT_AT, changeFrequency: "yearly", priority: 0.2 },
  ];
}
