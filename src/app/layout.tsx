import "./globals.css";
import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { SITE_URL } from "./site-url";
import { ServiceWorker } from "./service-worker";

const heading = Archivo({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-heading" });
const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  // The same constant the sitemap uses. Without it, canonical and share links
  // resolve against whatever host served the page, so a preview deployment
  // advertises itself as the real site.
  metadataBase: new URL(SITE_URL),
  title: "ZARODA BOOKS",
  description: "School books of accounts for bursars, heads of institution and accountants.",
  appleWebApp: { capable: true, title: "Zaroda Books", statusBarStyle: "black-translucent" },
  // Search Console's HTML-tag verification. Set GOOGLE_SITE_VERIFICATION to the
  // content value Google gives you; left unset, no tag is emitted at all.
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION }
    : undefined,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${heading.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
