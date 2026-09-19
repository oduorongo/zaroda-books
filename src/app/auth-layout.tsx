import Image from "next/image";
import Link from "next/link";

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
        {/* The photograph carries the lockup and the taglines, so neither is
            repeated here — only the line that changes between log in and sign up. */}
        <Image
          src="/auth-ui.png"
          alt="A Zaroda Solutions desk: bound volumes for school administration, learner records, results and reports, finance management and communication, beside a laptop and a notebook reading Better Schools Brighter Futures."
          width={1536}
          height={1024}
          priority
          sizes="(max-width: 900px) 100vw, 50vw"
        />
        <div className="auth-aside-copy">
          <div style={{ fontFamily: "var(--font-heading)", color: "var(--paper)", fontSize: "2.1rem", lineHeight: 1.15, fontWeight: 600, marginBottom: ".9rem", textWrap: "pretty" }}>
            {aside}
          </div>
          <Link href="/" className="eyebrow" style={{ color: "var(--on-dark)" }}>Back to site</Link>
        </div>
      </aside>
      <div className="form-side">
        <h1 style={{ fontSize: "1.75rem", margin: "0 0 .5rem" }}>{title}</h1>
        <p className="sub" style={{ margin: "0 0 2rem" }}>{subtitle}</p>
        {children}
      </div>
    </main>
  );
}
