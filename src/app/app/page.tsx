import { redirect } from "next/navigation";
import Link from "next/link";
import { describeAuditScope } from "@/domain";
import { auditorScope, getCurrentUser } from "@/server/auth";
import { getOrgBooks } from "@/server/queries";
import { BookChooser } from "./book-chooser";

/**
 * Where login lands. No book opens by itself: opening the first on the list
 * sent a freelancer's receipts into whichever school sorted first.
 */
export default async function AppIndex() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [books, grant] = await Promise.all([
    getOrgBooks(user.orgId, user.bookScope),
    auditorScope(user.id),
  ]);
  // An auditor with no books of their own came to audit, not to open one.
  if (!books.length) redirect(grant ? "/audit" : "/app/new");

  return (
    <div style={{ maxWidth: 820 }}>
      <h1>Choose a book</h1>
      <p className="sub">Open the school and year you are entering for.</p>
      {grant && (
        <div className="card" style={{ marginBottom: "1.25rem", borderLeft: "3px solid var(--gold)" }}>
          You are a Ministry auditor for {describeAuditScope(grant)}.{" "}
          <Link href="/audit">Open your audit list →</Link>
        </div>
      )}
      <BookChooser
        books={books.map((b) => ({
          accountId: b.account.id,
          school: b.school.name,
          level: b.school.level,
          account: b.account.name,
          fyLabel: b.fyLabel ?? "",
        }))}
      />
    </div>
  );
}
