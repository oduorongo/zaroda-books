/**
 * The canonical address of the marketing site, for the sitemap, robots and
 * metadata. One constant, because a sitemap that disagrees with the canonical
 * URL is worse than no sitemap — search engines treat the two spellings as
 * competing copies of the same page.
 *
 * SITE_URL overrides it, so a preview deployment does not advertise itself as
 * the real thing.
 */
export const SITE_URL = (process.env.SITE_URL || "https://zarodabooks.com").replace(/\/+$/, "");
