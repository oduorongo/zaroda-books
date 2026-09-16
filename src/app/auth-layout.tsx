import Link from "next/link";
import { Logo } from "./logo";

export function AuthLayout({
  title, subtitle, aside, children,
}: {
  title: string;
  subtitle: string;
  aside: string;
  children: React.ReactNode;
}) {
  return (
    <main className="auth">
      <aside>
        {/* Wrapped: the aside is a column flexbox, which would stretch the image itself. */}
        <div>
          <Logo height={104} variant="lockup" priority />
        </div>
        <div>
          <div style={{ fontFamily: "var(--font-heading)", color: "var(--paper)", fontSize: "2.1rem", lineHeight: 1.15, fontWeight: 600, marginBottom: "1.1rem", textWrap: "pretty" }}>
            {aside}
          </div>
          <div style={{ fontSize: ".95rem", lineHeight: 1.7, maxWidth: "40ch" }}>
            One login holds every school you keep books for. Vote heads, financial years and closed
            months stay exactly as you left them.
          </div>
        </div>
        <Link href="/" className="eyebrow" style={{ color: "var(--on-dark-dim)" }}>Back to site</Link>
      </aside>
      <div className="form-side">
        <h1 style={{ fontSize: "1.75rem", margin: "0 0 .5rem" }}>{title}</h1>
        <p className="sub" style={{ margin: "0 0 2rem" }}>{subtitle}</p>
        {children}
      </div>
    </main>
  );
}
