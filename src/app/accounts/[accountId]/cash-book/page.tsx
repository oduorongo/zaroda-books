import { buildCashBook, formatKes } from "@/domain";
import { demoHeads, demoOpening, inMonth } from "@/demo/ongora-simba";
import { Tabs } from "../tabs";

const MONTH = "2025-10";

const Amount = ({ c }: { c: number }) =>
  c === 0 ? <span className="zero">&ndash;</span> : <>{formatKes(c)}</>;

export default async function Page({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const cb = buildCashBook(demoOpening, inMonth(MONTH), demoHeads);

  const side = (title: string, rows: typeof cb.receipts, totals: typeof cb.receiptTotals) => (
    <>
      <h2>{title}</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th><th>Particulars</th><th>Ref</th>
            <th className="n">Cash</th><th className="n">Bank</th><th className="n">Total</th>
            {demoHeads.map((h) => <th key={h.code} className="n">{h.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.date.slice(8)}</td><td>{r.particulars}</td><td>{r.ref ?? ""}</td>
              <td className="n"><Amount c={r.cash} /></td>
              <td className="n"><Amount c={r.bank} /></td>
              <td className="n"><Amount c={r.total} /></td>
              {demoHeads.map((h) => (
                <td key={h.code} className="n"><Amount c={r.analysis[h.code] ?? 0} /></td>
              ))}
            </tr>
          ))}
          <tr className="total">
            <td colSpan={3}>Totals</td>
            <td className="n">{formatKes(totals.cash)}</td>
            <td className="n">{formatKes(totals.bank)}</td>
            <td className="n">{formatKes(totals.total)}</td>
            {demoHeads.map((h) => (
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
