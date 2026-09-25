import { can, QUERY_STATUS_LABEL } from "@/domain";
import { loadBook } from "@/server/book-context";
import { queriesForAccount } from "@/server/audit-queries";
import { getTxns } from "@/server/queries";
import { ReportShell } from "../report-shell";
import { RaiseQuery, Reply } from "./forms";

const when = (d: Date) =>
  d.toLocaleString("en-KE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function QueriesPage({ params, searchParams }: {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<{ txn?: string }>;
}) {
  const { accountId } = await params;
  const { txn } = await searchParams;
  const { user, fy, school, account } = await loadBook(accountId);
  const queries = await queriesForAccount(accountId);

  const auditing = user.auditing;
  const answers = !user.readOnly && can(user.role, "auditQuery.answer");

  // The entry the auditor clicked "Raise a query" on, if it is in this book.
  const entry = txn ? (await getTxns(fy.id)).find((t) => t.id === txn) : undefined;
  const entrySubject = !entry ? "The book as a whole"
    : `${entry.kind === "payment" ? `VR ${entry.vrNo ?? "—"}`
      : entry.kind === "receipt" ? `Receipt ${entry.receiptNo || "—"}` : "Transfer"} · ${entry.date} · ${entry.particulars}`;

  return (
    <ReportShell
      title="Audit queries"
      sub={<>
        {school.name} — {account.name}, FY {fy.label}. Queries the Ministry auditor has raised on this
        book and the school&apos;s answers. A query stays until the auditor closes it; none is ever deleted.
      </>}
      school={school.name} level={school.level} account={account.name} fyLabel={fy.label}
      csvHref={`/app/${accountId}/queries/export`}
    >
      {auditing && <RaiseQuery accountId={accountId} transactionId={entry?.id} subject={entrySubject} />}

      {queries.length === 0 && <p className="note">No audit queries on this book.</p>}

      {queries.map((q) => (
        <div key={q.id} className="card" style={{ marginBottom: "1.1rem", breakInside: "avoid" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "baseline", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 600 }}>⚑ {q.subject}</div>
            <span className={`verdict ${q.status === "closed" ? "ok" : "off"}`} style={{ margin: 0 }}>
              {QUERY_STATUS_LABEL[q.status]}
              {q.status === "open" ? " — the school's turn" : q.status === "answered" ? " — the auditor's turn" : ""}
            </span>
          </div>
          {q.messages.map((m) => (
            <div key={m.id} style={{ marginTop: ".75rem", paddingLeft: ".8rem", borderLeft: `3px solid ${m.fromAuditor ? "var(--ink)" : "var(--gold)"}` }}>
              <div className="note">{m.fromAuditor ? "Auditor" : "School"} · {m.name} · {when(m.at)}</div>
              <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
            </div>
          ))}
          {q.status === "closed" && q.closedAt && (
            <p className="note" style={{ marginTop: ".75rem" }}>Closed as settled on {when(q.closedAt)}.</p>
          )}
          {q.status !== "closed" && (auditing || answers) && (
            <Reply accountId={accountId} queryId={q.id} asAuditor={auditing} />
          )}
        </div>
      ))}
    </ReportShell>
  );
}
