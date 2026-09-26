import Link from "next/link";
import {
  accountTypesFor, can, financialYearInProgress, financialYearLabels, type AccountType,
} from "@/domain";
import { loadBook } from "@/server/book-context";
import { auditorsForSchool, auditStatus } from "@/server/audit-send";
import { issuedReportsOn, latestHandover } from "@/server/audit-reports";
import { HandoverForm } from "./handover-form";
import { describeAuditScope } from "@/domain";
import { getTxns } from "@/server/queries";
import { AccountTypeForm } from "./account-type-form";
import { FinancialYearForm } from "./form";
import { ArchiveForm } from "./archive-form";
import { SchoolForm } from "./school-form";
import { SendForAudit } from "./send-audit";
import { BackLink } from "../../back-link";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const { user, fy, school, account } = await loadBook(accountId);
  const [auditors, audit, reports, handover] = await Promise.all([
    auditorsForSchool(school),
    auditStatus(fy.id, account.auditSentTo),
    issuedReportsOn(school.id),
    latestHandover(school.id),
  ]);
  const sends = can(user.role, "book.sendForAudit") && !user.readOnly;
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

      <h2>Send for audit</h2>
      <div className="card" style={{ maxWidth: 720, marginBottom: "1.6rem" }}>
        {audit.sentTo ? (
          <p style={{ margin: 0 }}>
            <strong>Sent to {audit.sentTo.name}</strong> ({describeAuditScope(audit.sentTo.grant)})
            {account.auditSentAt ? ` on ${account.auditSentAt.toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" })}` : ""}.
            Only that auditor can read this book. Reopening any month takes it back.
          </p>
        ) : (
          <p className="note" style={{ margin: 0, lineHeight: 1.6 }}>
            No auditor can see this book. Once the year is closed up to June, send it to the
            Ministry auditor covering {school.subCounty ? `${school.subCounty}, ` : ""}{school.county ?? "the school's county"}.
            They can read it and raise queries, and change nothing.
          </p>
        )}
        {!school.county ? (
          <p className="note" style={{ marginTop: ".9rem" }}>
            Set the school&apos;s county and sub-county above first: an auditor covers a place.
          </p>
        ) : !audit.yearClosed ? (
          <p className="note" style={{ marginTop: ".9rem" }}>
            The year is not closed yet. <Link href={`/app/${accountId}/bank-reconciliation`}>Close it up to June</Link> on the bank reconciliation.
          </p>
        ) : auditors.length === 0 ? (
          <p className="note" style={{ marginTop: ".9rem" }}>No auditor covers this school&apos;s area yet.</p>
        ) : sends ? (
          <SendForAudit
            accountId={accountId}
            sentTo={account.auditSentTo}
            auditors={auditors.map((a) => ({ grantId: a.grant.id, label: `${a.name} — ${describeAuditScope(a.grant)}` }))}
          />
        ) : (
          <p className="note" style={{ marginTop: ".9rem" }}>The owner or accountant sends the books for audit.</p>
        )}
      </div>

      {sends && (
        <>
          <h2>Head of institution handing over</h2>
          <HandoverForm accountId={accountId} current={handover} />
        </>
      )}

      {can(user.role, "book.sendForAudit") && reports.length > 0 && (
        <>
          <h2>Audit reports</h2>
          <div className="card" style={{ maxWidth: 720, marginBottom: "1.6rem" }}>
            <p className="note" style={{ marginTop: 0 }}>Issued by the auditor on this school. Read-only.</p>
            {reports.map((r) => (
              <p key={r.id} style={{ margin: ".4rem 0" }}>
                <Link href={`/app/${accountId}/audit-reports/${r.id}`}>
                  {r.kind === "clearance"
                    ? `Clearance memo, for the years up to ${r.periodTo}`
                    : `IPSAS internal audit report, ${r.years ? JSON.parse(r.years).join(" and ") : ""}`}
                </Link>
                <span className="note"> — issued {r.issuedAt?.toLocaleDateString("en-KE")}</span>
              </p>
            ))}
          </div>
        </>
      )}

      <h2>Archive this book</h2>

      <ArchiveForm accountId={accountId} schoolName={school.name} entries={entries} />
    </>
  );
}
