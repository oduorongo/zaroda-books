import Link from "next/link";
import { logout } from "../login/actions";
import { Logo } from "../logo";
import { requirePlatformAdmin } from "@/server/platform";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdmin();

  return (
    <div>
      <div className="dark-band">
        <div
          className="wrap"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.5rem", flexWrap: "wrap" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: ".9rem" }}>
            <Logo height={34} priority />
            <div
              className="mono"
              style={{ letterSpacing: ".14em", fontSize: ".78rem", textTransform: "uppercase", borderLeft: "1px solid rgba(251,250,247,.3)", paddingLeft: ".9rem", color: "var(--gold)" }}
            >
              System&nbsp;owner
            </div>
          </div>
          <div className="admin-nav">
            <Link href="/admin" style={{ color: "var(--paper)" }}>Tenants</Link>
            <Link href="/admin/coverage" style={{ color: "var(--on-dark)" }}>Coverage</Link>
            <Link href="/app" style={{ color: "var(--on-dark)" }}>My own books</Link>
            <span style={{ color: "var(--on-dark-dim)" }}>{admin.email}</span>
            <form action={logout}>
              <button type="submit" className="btn-link" style={{ color: "var(--on-dark)", fontSize: ".88rem" }}>
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
      <div className="wrap" style={{ padding: "2.5rem 2.5rem 5rem" }}>{children}</div>
    </div>
  );
}
