import "./globals.css";
import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { SITE_URL } from "./site-url";

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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${heading.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
