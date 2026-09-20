import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zaroda Books",
    short_name: "Zaroda Books",
    description:
      "The books of accounts for Kenyan primary, junior and senior schools — cash book, "
      + "ledger, trial balance, bank reconciliation and cash flow, from one set of entries.",
    // Straight into the books. A bursar who installed the app wants the
    // workspace, not the sales page; signed out, /app redirects to the login.
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#10223f",
    theme_color: "#10223f",
    // Bursars work on phones held upright, and the books are long rather than
    // wide once the tables scroll on their own.
    orientation: "portrait-primary",
    categories: ["business", "finance", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
