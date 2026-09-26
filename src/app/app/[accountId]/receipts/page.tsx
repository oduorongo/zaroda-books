import Link from "next/link";
import {
  buildLedger, can, circularsFor, entryDates, flatOnlyHeadCodes, formatKes, isCapitationAccount, PROJECT_APPROVALS,
  PROJECT_STATUSES, seesCapitationLetter, takesProject, toKes,
} from "@/domain";
import type { AccountType } from "@/domain";
import { loadBook } from "@/server/book-context";
import { queriedEntries } from "@/server/audit-queries";
import { getTxns, receiptProjects } from "@/server/queries";
import { updateProjectAction } from "./actions";
import { ReceiptForm } from "./form";
import { OpeningBalances } from "./opening-balances";
import { ReportShell } from "../report-shell";

export default async function ReceiptsPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const { user, heads, fy, school, account } = await loadBook(accountId);
  const queried = await queriedEntries(accountId);
  // Boarding, lunch and the like take money from parents, not the Ministry:
  // no enrolment to derive, nothing to acknowledge.
  const capitation = isCapitationAccount(school.level, account.type as AccountType);
  const canAmend = can(user.role, "entry.amend") && !user.readOnly;
  const txns = await getTxns(fy.id);
  const project = takesProject(account.type as AccountType);
  const projects = project ? await receiptProjects(fy.id) : new Map();

  // Heads the circular funds per school: their rate box is closed.
  const flatOnly = flatOnlyHeadCodes(school.level, account.type as AccountType);

  const received = Object.fromEntries(
    buildLedger(txns, heads).map((l) => [l.code, l.cr]),
  );

  const receipts = txns
    .filter((t) => t.kind === "receipt")
    .sort((a, b) => b.date.localeCompare(a.date));
  const totalReceived = receipts.reduce((a, r) => a + (r.kind === "receipt" ? r.cash + r.bank : 0), 0);

  return (
    <ReportShell
      title="Receipts"
      sub={<>
        {school.name} — {account.name}, FY {fy.label}. {capitation
          ? "Enter the amount received and the rates per learner in force. The system derives the "
            + "enrolment from the amount and the vote heads used, then distributes the receipt so the "
            + "split equals the amount received to the shilling."
          : "Enter the amount received and how much of it goes to each vote head. This account is "
            + "funded per vote head, not per learner, so there is no enrolment."}
      </>}
      school={school.name} level={school.level} account={account.name} fyLabel={fy.label}
      csvHref={`/app/${accountId}/receipts/export`}
    >

      <OpeningBalances
        accountId={accountId}
        fyLabel={fy.label}
        openingCash={fy.openingCash ? String(toKes(fy.openingCash)) : ""}
        openingBank={fy.openingBank ? String(toKes(fy.openingBank)) : ""}
      />

      {capitation && seesCapitationLetter(user.position) && !user.readOnly && (
        <p className="no-print" style={{ margin: "0 0 1.1rem" }}>
          <Link href={`/app/${accountId}/capitation-letter`}>
            Capitation letter →
          </Link>
        </p>
      )}

      <ReceiptForm accountId={accountId} heads={heads}
        dates={entryDates(fy, txns.map((t) => t.date))}
        circulars={circularsFor(school.level, account.type as AccountType).map((c) => ({
          key: `${c.ref}|${c.date}`,
          label: `${c.programme} ${c.term} — ${c.ref}, ${c.date}`,
          note: c.note,
          figures: c.accounts[account.type as AccountType]!,
        }))}
        flatOnly={flatOnly} capitation={capitation} project={project} />

      <div className="grid-2" style={{ marginTop: "1.6rem", alignItems: "start" }}>
        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Total received per vote head</h2>
          <table>
            <thead>
              <tr><th>Vote head</th><th className="n">Total received</th></tr>
            </thead>
            <tbody>
              {heads.map((h) => (
                <tr key={h.code}>
                  <td><span className="code" style={{ marginRight: ".6rem" }}>{h.code}</span>{h.name}</td>
                  <td className="n">{formatKes(received[h.code] ?? 0)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total</td>
                <td className="n">{formatKes(totalReceived)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Receipts posted</h2>
          {receipts.length === 0 && <p className="note">Nothing posted yet.</p>}
          {receipts.map((r) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", padding: ".75rem 0", borderBottom: "1px solid var(--rule-soft)" }}>
              <div style={{ fontSize: ".9rem" }}>
                <div style={{ fontWeight: 500 }}>{queried.has(r.id) && <span title="An audit query on this entry is not yet closed" style={{ color: "var(--alarm)" }}>⚑ </span>}{r.particulars}</div>
                <div className="note">
                  {r.date}{r.kind === "receipt" && r.receiptNo ? ` · ${r.receiptNo}` : ""}
                </div>
                {projects.get(r.id) && (
                  <div className="note" style={{ marginTop: ".3rem" }}>
                    Project: <strong>{projects.get(r.id).project}</strong>
                    {canAmend ? (
                      <form action={updateProjectAction} style={{ display: "flex", gap: ".4rem", marginTop: ".3rem", flexWrap: "wrap" }}>
                        <input type="hidden" name="accountId" value={accountId} />
                        <input type="hidden" name="transactionId" value={r.id} />
                        <select name="projectApproval" defaultValue={projects.get(r.id).approval ?? ""} aria-label="SCDE approval">
                          {PROJECT_APPROVALS.map((a) => <option key={a}>{a}</option>)}
                        </select>
                        <select name="projectStatus" defaultValue={projects.get(r.id).status ?? ""} aria-label="Project status">
                          {PROJECT_STATUSES.map((s) => <option key={s}>{s}</option>)}
                        </select>
                        <button type="submit" className="btn-link">Update</button>
                      </form>
                    ) : (
                      <> · {projects.get(r.id).approval} · {projects.get(r.id).status}</>
                    )}
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                <div className="mono" style={{ fontSize: ".9rem" }}>
                  {formatKes(r.kind === "receipt" ? r.cash + r.bank : 0)}
                </div>
                {capitation && (
                  <Link className="note" href={`/app/${accountId}/receipts/${r.id}/acknowledgement`}>
                    Acknowledgement
                  </Link>
                )}
                {canAmend && (
                  <Link className="note no-print" href={`/app/${accountId}/receipts/${r.id}/edit`} style={{ marginLeft: capitation ? ".6rem" : 0 }}>
                    Amend
                  </Link>
                )}
                {user.auditing && (
                  <Link className="note no-print" href={`/app/${accountId}/queries?txn=${r.id}`} style={{ marginLeft: ".6rem" }}>Query</Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </ReportShell>
  );
}
