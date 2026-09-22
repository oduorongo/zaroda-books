import {
  accountTypesFor, financialYearInProgress, financialYearLabels, type AccountType,
} from "@/domain";
import { loadBook } from "@/server/book-context";
import { auditorsOverOrg } from "@/server/audit";
import { describeAuditScope } from "@/domain";
import { getTxns } from "@/server/queries";
import { AccountTypeForm } from "./account-type-form";
import { FinancialYearForm } from "./form";
import { ArchiveForm } from "./archive-form";
import { SchoolForm } from "./school-form";
import { BackLink } from "../../back-link";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const { user, fy, school, account } = await loadBook(accountId);
  const auditors = await auditorsOverOrg(user.orgId);
  const entries = (await getTxns(fy.id)).length;

  // The year the book is on may be older than the list a new book is offered,
  // so it is always included — otherwise the form would show the wrong one.
  const offered = financialYearLabels(financialYearInProgress(), 2022);
  const years = offered.includes(fy.label)
    ? offered
    : [...offered, fy.label].sort().reverse();

  return (
    <>
      <div className="no-print" style={{ marginBottom: ".75rem" }}>
        <BackLink />
      </div>
      <h1>Book settings</h1>
      <p className="sub">
        {school.name} — {account.name}, FY {fy.label}.
      </p>

      <h2>School</h2>
      <SchoolForm
        accountId={accountId}
        name={school.name}
        county={school.county}
        subCounty={school.subCounty}
        locked={entries > 0}
      />

      <h2>Financial year</h2>
      <FinancialYearForm
        accountId={accountId}
        current={fy.label}
        years={years}
        entries={entries}
      />

      <h2>Account type</h2>
      <AccountTypeForm
        accountId={accountId}
        current={account.type as AccountType}
        options={accountTypesFor(school.level)}
        entries={entries}
      />

      <h2>Archive this book</h2>
      {auditors.length > 0 && (
        <div className="card" style={{ maxWidth: 720, marginBottom: "1.6rem" }}>
          <div className="eyebrow" style={{ color: "var(--gold)" }}>Who else can read these books</div>
          <p className="note" style={{ margin: ".5rem 0 .9rem", lineHeight: 1.6 }}>
            Ministry internal auditors hold a standing right to read the books of schools in
            their area. They can change nothing, and every school they open is recorded in the
            audit log below.
          </p>
          <table>
            <thead><tr><th>Auditor</th><th>Area</th></tr></thead>
            <tbody>
              {auditors.map((a) => (
                <tr key={a.auditor.id}>
                  <td>{a.name}<div className="note">{a.email}</div></td>
                  <td>{describeAuditScope(a.auditor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ArchiveForm accountId={accountId} schoolName={school.name} entries={entries} />
    </>
  );
}
