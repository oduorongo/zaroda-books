import Link from "next/link";
import {
  buildLedger, circularsFor, entryDates, flatOnlyHeadCodes, formatKes, isCapitationAccount, seesCapitationLetter, toKes,
} from "@/domain";
import type { AccountType } from "@/domain";
import { loadBook } from "@/server/book-context";
import { getTxns } from "@/server/queries";
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
  // Boarding, lunch and the like take money from parents, not the Ministry:
  // no enrolment to derive, nothing to acknowledge.
  const capitation = isCapitationAccount(school.level, account.type as AccountType);
  const txns = await getTxns(fy.id);

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
        {school.name} — {account.name}, FY {fy.label}. Enter the amount received and the rates per
        learner in force. The system derives the enrolment from the amount and the vote heads used,
        then distributes the receipt so the split equals the amount received to the shilling.
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
          date: c.date,
          label: `${c.programme} ${c.term} — ${c.ref}, ${c.date}`,
          note: c.note,
          figures: c.accounts[account.type as AccountType]!,
        }))}
        flatOnly={flatOnly} capitation={capitation} />

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
                <div style={{ fontWeight: 500 }}>{r.particulars}</div>
                <div className="note">
                  {r.date}{r.kind === "receipt" && r.receiptNo ? ` · ${r.receiptNo}` : ""}
                </div>
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
              </div>
            </div>
          ))}
        </div>
      </div>
    </ReportShell>
  );
}
