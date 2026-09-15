import { buildCashBook, formatKes } from "@/domain";
import { getVoteHeads, getFinancialYear, getTxns, inMonth } from "@/server/queries";
import { Tabs } from "../tabs";

const MONTH = "2025-10";

const Amount = ({ c }: { c: number }) =>
  c === 0 ? <span className="zero">&ndash;</span> : <>{formatKes(c)}</>;

export default async function Page({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const heads = await getVoteHeads(accountId);
  const fy = await getFinancialYear(accountId);
  const opening = { cash: fy.openingCash, bank: fy.openingBank };
  const txns = await getTxns(fy.id);
  const cb = buildCashBook(opening, inMonth(txns, MONTH), heads);

  const side = (title: string, rows: typeof cb.receipts, totals: typeof cb.receiptTotals) => (
    <>
      <h2>{title}</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th><th>Particulars</th><th>Ref</th>
            <th className="n">Cash</th><th className="n">Bank</th><th className="n">Total</th>
            {heads.map((h) => <th key={h.code} className="n">{h.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.date.slice(8)}</td><td>{r.particulars}</td><td>{r.ref ?? ""}</td>
              <td className="n"><Amount c={r.cash} /></td>
              <td className="n"><Amount c={r.bank} /></td>
              <td className="n"><Amount c={r.total} /></td>
              {heads.map((h) => (
                <td key={h.code} className="n"><Amount c={r.analysis[h.code] ?? 0} /></td>
              ))}
            </tr>
          ))}
          <tr className="total">
            <td colSpan={3}>Totals</td>
            <td className="n">{formatKes(totals.cash)}</td>
            <td className="n">{formatKes(totals.bank)}</td>
            <td className="n">{formatKes(totals.total)}</td>
            {heads.map((h) => (
              <td key={h.code} className="n">{formatKes(totals.analysis[h.code] ?? 0)}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </>
  );

  return (
    <main>
      <h1>Analysed cash book</h1>
      <p className="sub">October 2025 &mdash; SIMBA account</p>
      <Tabs accountId={accountId} active="cash-book" />
      {side("Receipts", cb.receipts, cb.receiptTotals)}
      {side("Payments", cb.payments, cb.paymentTotals)}
      <p className="verdict ok">
        Balance carried down &mdash; cash {formatKes(cb.closing.cash)}, bank{" "}
        {formatKes(cb.closing.bank)}
      </p>
    </main>
  );
}
