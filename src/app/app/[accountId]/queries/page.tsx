import Link from "next/link";
import { QUERY_STATUS_LABEL, queryPartyFor } from "@/domain";
import { loadBook } from "@/server/book-context";
import { queriesForAccount } from "@/server/audit-queries";
import { getTxns } from "@/server/queries";
import { ReportShell } from "../report-shell";
import { RaiseQuery, Readdress, Reply } from "./forms";

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
  const partyOn = (addressedTo: "school" | "hoi") =>
    auditing ? "auditor" as const : user.readOnly ? null : queryPartyFor(user, addressedTo);
  const noHoiEmail = !school.hoiEmail && queries.some((q) => q.addressedTo === "hoi" && q.status !== "closed");

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

      {noHoiEmail && !auditing && (
        <p className="error no-print">
          A query is waiting for the head of institution, but the head has no email on record, so it has not reached
          them. Set it in <Link href={`/app/${accountId}/settings`}>Book settings</Link>, under Authorisation of payments.
        </p>
      )}

      {queries.length === 0 && <p className="note">No audit queries on this book.</p>}

      {queries.map((q) => {
        const party = partyOn(q.addressedTo);
        const turn = q.status === "open" ? (q.addressedTo === "hoi" ? " — the head's turn" : " — the school's turn")
          : q.status === "answered" ? " — the auditor's turn" : "";
        return (
          <div key={q.id} className="card" style={{ marginBottom: "1.1rem", breakInside: "avoid" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "baseline", flexWrap: "wrap" }}>
              <div style={{ fontWeight: 600 }}>⚑ {q.subject}</div>
              <span className={`verdict ${q.status === "closed" ? "ok" : "off"}`} style={{ margin: 0 }}>
                {QUERY_STATUS_LABEL[q.status]}{turn}
              </span>
            </div>
            <div className="note" style={{ marginTop: ".3rem" }}>
              For {q.addressedTo === "hoi" ? "the head of institution" : "whoever keeps the books"}
              {auditing && q.status !== "closed" && <> · <Readdress accountId={accountId} queryId={q.id} addressedTo={q.addressedTo} /></>}
            </div>
            {q.messages.map((m) => (
              <div key={m.id} style={{ marginTop: ".75rem", paddingLeft: ".8rem", borderLeft: `3px solid ${m.fromAuditor ? "var(--ink)" : "var(--gold)"}` }}>
                <div className="note">
                  {m.fromAuditor ? "Auditor" : m.fromHoi ? "Head of institution" : "School"} · {m.name}
                  {m.via ? ` (${m.via})` : ""} · {when(m.at)}
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{m.body}</div>
              </div>
            ))}
            {q.status === "closed" && q.closedAt && (
              <p className="note" style={{ marginTop: ".75rem" }}>Closed as settled on {when(q.closedAt)}.</p>
            )}
            {q.status !== "closed" && party && (
              <Reply accountId={accountId} queryId={q.id} party={party} addressedTo={q.addressedTo} />
            )}
          </div>
        );
      })}
    </ReportShell>
  );
}
