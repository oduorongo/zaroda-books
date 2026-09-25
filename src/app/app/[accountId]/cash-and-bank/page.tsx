import Link from "next/link";
import { balancesAfter, entryDates, formatKes } from "@/domain";
import { loadBook } from "@/server/book-context";
import { queriedEntries } from "@/server/audit-queries";
import { getReceiptBankings, getTxns } from "@/server/queries";
import { TransferForm } from "./form";

export default async function CashAndBankPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const { user, fy, school, account } = await loadBook(accountId);
  const queried = await queriedEntries(accountId);
  const [txns, bankings] = await Promise.all([getTxns(fy.id), getReceiptBankings(fy.id)]);

  const balances = balancesAfter({ cash: fy.openingCash, bank: fy.openingBank }, txns);
  const transfers = txns
    .filter((t) => t.kind === "contra")
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <h1>Cash and bank</h1>
      <p className="sub">
        {school.name} — {account.name}, FY {fy.label}. Moving money between the cash box and the
        bank account. A transfer is charged to no vote head and is neither income nor expenditure:
        it appears on both sides of the cash book and nets to nothing.
      </p>

      <div className="grid-2" style={{ marginBottom: "1.6rem" }}>
        <div className="card">
          <div className="note">Cash in hand</div>
          <div className="mono" style={{ fontSize: "1.5rem", marginTop: ".35rem" }}>
            {formatKes(balances.cash)}
          </div>
        </div>
        <div className="card">
          <div className="note">Balance at bank</div>
          <div className="mono" style={{ fontSize: "1.5rem", marginTop: ".35rem" }}>
            {formatKes(balances.bank)}
          </div>
        </div>
      </div>

      <TransferForm accountId={accountId} cash={balances.cash} bank={balances.bank}
        dates={entryDates(fy, txns.map((t) => t.date))} />

      <div className="card" style={{ marginTop: "1.6rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Transfers posted</h2>
        {transfers.length === 0 && <p className="note">No transfers yet.</p>}
        {transfers.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Particulars</th><th>Cheque no.</th>
                <th>Direction</th><th className="n">Amount</th><th className="no-print" />
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id}>
                  <td className="mono" style={{ color: "var(--muted)" }}>{t.date}</td>
                  <td>{queried.has(t.id) && <span title="An audit query on this entry is not yet closed" style={{ color: "var(--alarm)" }}>⚑ </span>}{t.particulars}</td>
                  <td className="mono">{t.kind === "contra" ? t.chequeNo ?? "—" : "—"}</td>
                  <td>{t.kind === "contra" && t.from === "cash" ? "Cash to bank" : "Cash from bank"}</td>
                  <td className="n">{formatKes(t.kind === "contra" ? t.amount : 0)}</td>
                  <td className="no-print" style={{ whiteSpace: "nowrap" }}>
                    {/* A receipt's own banking follows the receipt, so it is amended there. */}
                    {bankings.has(t.id) ? (
                      <Link className="note" href={`/app/${accountId}/receipts/${bankings.get(t.id)!.receiptId}/edit`}>
                        Banked with receipt {bankings.get(t.id)!.receiptNo}
                      </Link>
                    ) : (
                      <Link href={`/app/${accountId}/cash-and-bank/${t.id}/edit`}>Amend</Link>
                    )}
                    {user.auditing && (
                  <Link className="note no-print" href={`/app/${accountId}/queries?txn=${t.id}`} style={{ marginLeft: ".6rem" }}>Query</Link>
                )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
