import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ZARODA BOOKS",
  description: "School books of accounts for bursars, heads of institution and accountants.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><div className="sheet">{children}</div></body>
    </html>
  );
}
