"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./logo";

/** The navy bar along the top of every page, as in the other Zaroda apps. The home page's menu lives in it. */
export function TopRibbon() {
  const home = usePathname() === "/";
  return (
    <header className="ribbon ribbon-top no-print">
      <Link href="/" className="ribbon-brand" aria-label="Zaroda Books home">
        <Logo height={34} priority />
        <span>Zaroda&nbsp;Books</span>
      </Link>
      {home && (
        <nav className="ribbon-nav">
          <a href="#how">How it works</a>
          <a href="#books">What it produces</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">Questions</a>
          <Link href="/login" style={{ color: "var(--paper)" }}>Log in</Link>
          <Link href="/signup" className="btn btn-gold" style={{ color: "#fff", textDecoration: "none", padding: ".6rem 1.1rem", fontSize: ".9rem" }}>
            Create account
          </Link>
        </nav>
      )}
    </header>
  );
}

/** The navy "Powered by ZARODA SOLUTIONS" bar along the bottom of every page. */
export function BottomRibbon() {
  return (
    <footer className="ribbon ribbon-bottom no-print">
      <span className="ribbon-long">Powered by </span>
      <strong>ZARODA SOLUTIONS</strong>
      <span className="ribbon-short"> · </span>
      <span className="ribbon-long"> - </span>
      Innovative. Reliable. Forward.
    </footer>
  );
}
