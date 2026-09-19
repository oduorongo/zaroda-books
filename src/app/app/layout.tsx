import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser, isPlatformAdmin } from "@/server/auth";
import { getOrgBooks } from "@/server/queries";
import { logout } from "../login/actions";
import { Logo } from "../logo";
import { BookSwitcher } from "./book-switcher";
import { SideNav } from "./side-nav";
import { ViewAsBanner } from "./view-as-banner";

/** "Jane Atieno Ochieng" becomes JO: the first name and the last, never the middle. */
const initials = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [books, admin] = await Promise.all([
    getOrgBooks(user.orgId),
    isPlatformAdmin(user.id),
  ]);

  return (
    <>
      {user.viewingAs && <ViewAsBanner orgName={user.viewingAs.orgName} />}
    <div className="shell">
      <nav className="sidebar">
        <div className="sidebar-head">
          <Logo height={78} variant="lockup" priority />
          <div className="mono">Zaroda&nbsp;Books</div>
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

        <div className="sidebar-foot">
          <div className="who">
            <span className="avatar" aria-hidden="true">{initials(user.name)}</span>
            <span>
              <strong>{user.name}</strong>
              <span className="role">{user.role}</span>
            </span>
          </div>
          {admin && !user.viewingAs && <Link href="/admin">System owner</Link>}
          <form action={logout}>
            <button type="submit" className="btn-link">Sign out</button>
          </form>
        </div>
      </nav>

      <main className="workspace">{children}</main>
    </div>
    </>
  );
}
