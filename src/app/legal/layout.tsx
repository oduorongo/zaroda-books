import Link from "next/link";
import { Logo } from "../logo";

/** A plain reading surface for the privacy policy and the terms. */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main>
      <div className="dark-band">
        <div className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.5rem", flexWrap: "wrap" }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: ".9rem", textDecoration: "none" }}>
            <Logo height={34} priority />
            <span className="mono" style={{ letterSpacing: ".14em", fontSize: ".78rem", textTransform: "uppercase", color: "var(--paper)" }}>
              Zaroda&nbsp;Books
            </span>
          </Link>
          <div style={{ display: "flex", gap: "1.5rem", fontSize: ".9rem" }}>
            <Link href="/privacy" style={{ color: "var(--on-dark)" }}>Privacy</Link>
            <Link href="/terms" style={{ color: "var(--on-dark)" }}>Terms</Link>
            <Link href="/" style={{ color: "var(--on-dark)" }}>Home</Link>
          </div>
        </div>
      </div>

      <article className="legal wrap">{children}</article>

      <footer className="dark-band">
        <div className="wrap" style={{ padding: "2rem 2.5rem", fontSize: ".9rem" }}>
          Zaroda Solutions · <a href="mailto:info@zarodasolutions.com">info@zarodasolutions.com</a> ·{" "}
          <a href="tel:+254724282065">0724 282 065</a>
        </div>
      </footer>
    </main>
  );
}
