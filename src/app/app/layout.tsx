import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { getOrgBooks } from "@/server/queries";
import { logout } from "../login/actions";
import { Logo } from "../logo";
import { BookSwitcher } from "./book-switcher";
import { SideNav } from "./side-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const books = await getOrgBooks(user.orgId);

  return (
    <div className="shell">
      <nav className="sidebar">
        <div style={{ display: "flex", alignItems: "center", gap: ".7rem" }}>
          <Logo height={34} priority />
          <div className="mono" style={{ letterSpacing: ".12em", fontSize: ".72rem", textTransform: "uppercase", color: "var(--paper)" }}>
            Zaroda&nbsp;Books
          </div>
        </div>

        <div>
          <div className="eyebrow" style={{ color: "var(--on-dark-dim)", marginBottom: ".5rem" }}>School</div>
          <BookSwitcher
            books={books.map((b) => ({
              accountId: b.account.id,
              label: `${b.school.name} — ${b.account.name}`,
            }))}
          />
          <div style={{ fontSize: ".78rem", color: "var(--on-dark-dim)", marginTop: ".5rem" }}>
            {books.length === 1 ? "1 book on this account" : `${books.length} books on this account`}
          </div>
        </div>

        <SideNav />

        <div style={{ marginTop: "auto", fontSize: ".78rem", lineHeight: 1.6, color: "var(--on-dark-dim)" }}>
          <div>{user.name} · {user.role}</div>
          <form action={logout}>
            <button type="submit" className="btn-link" style={{ color: "var(--on-dark)", fontSize: ".78rem", paddingTop: ".25rem" }}>
              Sign out
            </button>
          </form>
        </div>
      </nav>

      <main className="workspace">{children}</main>
    </div>
  );
}
