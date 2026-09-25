import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { auditorScope, getCurrentUser, isPlatformAdmin, myOrgs } from "@/server/auth";
import { describeAuditScope } from "@/domain";
import { getOrgBooks } from "@/server/queries";
import { waitingCounts } from "@/server/audit-queries";
import { logout } from "../login/actions";
import { Logo } from "../logo";
import { BookSwitcher } from "./book-switcher";
import { SideNav } from "./side-nav";
import { ViewAsBanner } from "./view-as-banner";
import { OrgSwitcher } from "./org-switcher";

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

  const [books, admin, orgs, grant] = await Promise.all([
    getOrgBooks(user.orgId, user.bookScope),
    isPlatformAdmin(user.id),
    myOrgs(user.id),
    auditorScope(user.id),
  ]);

  return (
    <>
      {user.viewingAs && (
        <ViewAsBanner orgName={user.viewingAs.orgName} asAuditor={user.auditing} />
      )}
    <div className="shell">
      <nav className="sidebar">
        {/* The photograph already carries the mark, the wordmark and the gold
            rule, so none of the three is drawn again over it. */}
        <div className="sidebar-head">
          <Image
            src="/nav-hero.png"
            alt="Zaroda Books"
            width={1024}
            height={1536}
            priority
            sizes="268px"
          />
        </div>

        {/* Only when there is a choice to make. */}
        {/* An auditor keeps books of their own too; their audits are one click away. */}
        {grant && (
          <Link href="/audit" className="btn btn-quiet" style={{ display: "block", textAlign: "center", color: "var(--on-dark)" }}>
            Audit — {describeAuditScope(grant)}
          </Link>
        )}

        {orgs.length > 1 && !user.viewingAs && (
          <OrgSwitcher orgs={orgs} current={user.orgId} />
        )}

        <div>
          <div className="eyebrow" style={{ color: "var(--on-dark-dim)", marginBottom: ".5rem" }}>School</div>
          <BookSwitcher
            books={books.map((b) => ({
              accountId: b.account.id,
              label: `${b.school.name} — ${b.account.name}${b.fyLabel ? ` ${b.fyLabel}` : ""}`,
            }))}
          />
          <div style={{ fontSize: ".78rem", color: "var(--on-dark-dim)", marginTop: ".5rem" }}>
            {books.length === 1 ? "1 book on this account" : `${books.length} books on this account`}
          </div>
        </div>

        <SideNav queries={await waitingCounts(books.map((b) => b.account.id), user.auditing)} />

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
          <a
            href="https://zarodasolutions.app"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: ".78rem", color: "var(--on-dark-dim)" }}
          >
            Zaroda School
          </a>
        </div>
      </nav>

      <main className="workspace">{children}</main>
    </div>
    </>
  );
}
