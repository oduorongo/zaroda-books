import Link from "next/link";
import { cashMoves, entryDates, buildLedger, formatKes, can, mayAuthorise, authorisationLine, takesProject, type AccountType, type AuthorisationState } from "@/domain";
import type { Txn, VoteEntry } from "@/domain";
import { loadBook } from "@/server/book-context";
import { queriedEntries } from "@/server/audit-queries";
import { getTxns } from "@/server/queries";
import { PaymentForm } from "./form";
import { ReportShell } from "../report-shell";
import { AuthorisationPanel } from "./authorisation-panel";
import { decisionRow } from "../../../decision-table";
import { needsHoi, paymentStatuses, requestsFor } from "@/server/authorisation";
import { documentsFor, schoolProjects, type PaymentDocument } from "@/server/documents";

function HoiStatus({ s }: { s: AuthorisationState | undefined }) {
  if (!s || s.state === "awaiting") return <span className="note">Awaiting</span>;
  if (s.state === "changed") return <span className="error">Amended since authorised</span>;
  if (s.state === "held") return <span className="error" title={s.reason}>Held back</span>;
  return <span title={authorisationLine(s.record)}>✓ Authorised</span>;
}

/** What the payment rests on: each attached file opens; an original kept on paper says so. */
function Evidence({ accountId, docs }: { accountId: string; docs: PaymentDocument[] | undefined }) {
  if (!docs?.length) return <span className="error">None</span>;
  return (
    <>
      {docs.map((d, i) => (
        <span key={d.id}>
          {i > 0 && ", "}
          {d.blobPath
            ? <a href={`/app/${accountId}/documents/${d.id}`} target="_blank" rel="noreferrer">📎 {d.kind}</a>
            : <span title="The original is on the paper file">{d.kind} (paper)</span>}
        </span>
      ))}
    </>
  );
}

/** Every receipt and payment line, so the form can date the balances. */
const voteEntries = (txns: Txn[]): VoteEntry[] =>
  txns.flatMap((t) =>
    t.kind === "contra"
      ? []
      : t.allocations.map((a) => ({
        code: a.voteHeadCode,
        date: t.date,
        amount: a.amount,
        isPayment: t.kind === "payment",
      })),
  );
export default async function PaymentsPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const { user, heads, fy, school, account } = await loadBook(accountId);
  const queried = await queriedEntries(accountId);
  const txns = await getTxns(fy.id);

  const entries = voteEntries(txns);
  const payments = txns
    .filter((t) => t.kind === "payment")
    .sort((a, b) => a.date.localeCompare(b.date));
  const totalCash = payments.reduce((a, p) => a + (p.kind === "payment" ? p.cash : 0), 0);
  const totalBank = payments.reduce((a, p) => a + (p.kind === "payment" ? p.bank : 0), 0);

  const infrastructure = takesProject(account.type as AccountType);
  const [statuses, requests, projects] = await Promise.all([
    paymentStatuses(txns), requestsFor(accountId), infrastructure ? schoolProjects(school.id) : null,
  ]);
  const statusOf = new Map(statuses.map((s) => [s.payment.id, s.status]));
  const docs = await documentsFor(statuses.map((s) => s.payment.id));
  const docLinks = (id: string) => (docs.get(id) ?? []).map((d) => ({
    label: d.kind, href: d.blobPath ? `/app/${accountId}/documents/${d.id}` : null,
  }));
  const pending = statuses.filter(needsHoi);
  const held = statuses.flatMap((s) =>
    s.status.state === "held" ? [{ vrNo: s.payment.vrNo, payee: s.payment.particulars, reason: s.status.reason }] : []);

  return (
    <ReportShell
      title="Payments"
      sub={<>
        {school.name} — {account.name}, FY {fy.label}. Each payment is charged to one or more vote heads,
        each with its own amount, and to either cash or bank.
      </>}
      school={school.name} level={school.level} account={account.name} fyLabel={fy.label}
      csvHref={`/app/${accountId}/payments/export`}
      landscape
    >

      <p className="no-print" style={{ margin: "0 0 1.4rem" }}>
        {infrastructure && (
          <><Link href={`/app/${accountId}/projects`}>Projects and SCDE approvals →</Link>{" · "}</>
        )}
        <Link href={`/app/${accountId}/payments/vouchers`}>
          Print the year's voucher book →
        </Link>{" "}
        <span className="note">
          All {payments.length} voucher{payments.length === 1 ? "" : "s"}, one to a page, numbered
          1 to {payments.length} in date order.
        </span>
      </p>

      <AuthorisationPanel
        accountId={accountId}
        counts={{ authorised: statuses.length - pending.length - held.length, pending: pending.length, held: held.length }}
        pending={pending.map((s) => decisionRow(s.payment, s.terms, docLinks(s.payment.id)))}
        held={held}
        iAuthorise={mayAuthorise(user.role, user.position) && !user.readOnly}
        iPost={can(user.role, "entry.post") && !user.readOnly}
        route={school.authRoute}
        hoi={{ name: school.hoiName, email: school.hoiEmail }}
        openSchedules={requests
          .filter((r) => r.route === "paper" && !r.completedAt)
          .map((r) => ({ id: r.id, printed: r.createdAt.toISOString().slice(0, 10), count: JSON.parse(r.payments).length }))}
      />

      {can(user.role, "entry.post") && (
        <PaymentForm
          accountId={accountId}
          heads={heads}
          entries={entries}
          openingCash={fy.openingCash}
          cashMoves={cashMoves(txns)}
          dates={entryDates(fy, txns.map((t) => t.date))}
          projects={projects?.map((p) => ({ name: p.name, approved: Boolean(p.letter) }))}
        />
      )}

      <div className="card" style={{ marginTop: "1.6rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Payments recorded</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th><th>VR no.</th><th>Particulars</th><th>Vote heads</th>
              <th className="n">Cash</th><th className="n">Bank</th><th>Evidence</th><th>Head</th><th></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="mono" style={{ color: "var(--muted)" }}>{p.date}</td>
                <td className="mono">{p.kind === "payment" ? p.vrNo ?? "—" : "—"}</td>
                <td>{queried.has(p.id) && <span title="An audit query on this entry is not yet closed" style={{ color: "var(--alarm)" }}>⚑ </span>}{p.particulars}</td>
                <td>
                  {p.kind === "payment" && p.allocations.length
                    ? p.allocations.map((a) => (
                        <span key={a.voteHeadCode} className="code" style={{ marginRight: ".4rem" }}>
                          {a.voteHeadCode} {formatKes(a.amount)}
                        </span>
                      ))
                    : "—"}
                </td>
                <td className="n">{p.kind === "payment" && p.cash ? formatKes(p.cash) : "—"}</td>
                <td className="n">{p.kind === "payment" && p.bank ? formatKes(p.bank) : "—"}</td>
                <td style={{ fontSize: ".84rem" }}><Evidence accountId={accountId} docs={docs.get(p.id)} /></td>
                <td><HoiStatus s={statusOf.get(p.id)} /></td>
                <td className="n">
                  <Link className="note" href={`/app/${accountId}/payments/${p.id}/voucher`}>View</Link>
                  {user.auditing && (
                  <Link className="note no-print" href={`/app/${accountId}/queries?txn=${p.id}`} style={{ marginLeft: ".6rem" }}>Query</Link>
                )}
                </td>
              </tr>
            ))}
            <tr className="total">
              <td colSpan={4}>Total paid</td>
              <td className="n">{formatKes(totalCash)}</td>
              <td className="n">{formatKes(totalBank)}</td>
              <td className="note">{payments.filter((p) => docs.has(p.id)).length} of {payments.length}</td>
              <td></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </ReportShell>
  );
}
