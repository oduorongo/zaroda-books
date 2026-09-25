import { balancesAfter, buildCashBook, formatKes } from "@/domain";
import type { Balances } from "@/domain";
import { loadBook } from "@/server/book-context";
import { before, getTxns, inMonth } from "@/server/queries";
import { getReportPeriod, monthKey, monthName } from "@/server/periods";
import { BookTabs } from "../book-tabs";
import { MonthPicker } from "../month-picker";
import { ReportShell } from "../report-shell";

const Amount = ({ c }: { c: number }) =>
  c === 0 ? <span className="zero">&ndash;</span> : <>{formatKes(c)}</>;

export default async function Page({ params, searchParams }: {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { accountId } = await params;
  const { month: asked } = await searchParams;
  const { heads, fy, school, account } = await loadBook(accountId);
  const txns = await getTxns(fy.id);
  const { period, periods } = await getReportPeriod(fy.id, txns, asked);
  const month = monthKey(period.month);
  const posted = new Set(txns.map((t) => t.date.slice(0, 7)));

  // The month opens where the last one closed. Only the first month of the
  // year opens on the balances brought forward into the book.
  const opening = balancesAfter(
    { cash: fy.openingCash, bank: fy.openingBank },
    before(txns, month),
  );
  const cb = buildCashBook(opening, inMonth(txns, month), heads);

  const side = (
    title: string,
    rows: typeof cb.receipts,
    totals: typeof cb.receiptTotals,
    carry: { label: string; balances: Balances } | null,
    isReceiptsSide: boolean,
  ) => {
    // Balance b/d sits on the receipts side and c/d on the payments side, so
    // the two sides total the same figure — that is the point of the form.
    const sideTotal = {
      cash: totals.cash + (carry ? carry.balances.cash : 0),
      bank: totals.bank + (carry ? carry.balances.bank : 0),
      total: totals.total,
    };
    return (
      <>
        <h2>{title}</h2>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Particulars</th><th>Ref</th>
                <th className="n">Cash</th><th className="n">Bank</th><th className="n">Total</th>
                {heads.map((h) => <th key={h.code} className="n">{h.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {isReceiptsSide && carry && (
                <tr className="carry">
                  <td /><td>{carry.label}</td><td />
                  <td className="n"><Amount c={carry.balances.cash} /></td>
                  <td className="n"><Amount c={carry.balances.bank} /></td>
                  <td className="n"><span className="zero">&ndash;</span></td>
                  {heads.map((h) => <td key={h.code} className="n"><span className="zero">&ndash;</span></td>)}
                </tr>
              )}
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
              {!isReceiptsSide && carry && (
                <tr className="carry">
                  <td /><td>{carry.label}</td><td />
                  <td className="n"><Amount c={carry.balances.cash} /></td>
                  <td className="n"><Amount c={carry.balances.bank} /></td>
                  <td className="n"><span className="zero">&ndash;</span></td>
                  {heads.map((h) => <td key={h.code} className="n"><span className="zero">&ndash;</span></td>)}
                </tr>
              )}
              <tr className="total">
                <td colSpan={3}>Totals</td>
                <td className="n">{formatKes(sideTotal.cash)}</td>
                <td className="n">{formatKes(sideTotal.bank)}</td>
                <td className="n">{formatKes(sideTotal.total)}</td>
                {heads.map((h) => (
                  <td key={h.code} className="n">{formatKes(totals.analysis[h.code] ?? 0)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </>
    );
  };

  return (
    <ReportShell
      title="Analysed cash book"
      sub={<>{monthName(period.month)} — {school.name}, {account.name} account</>}
      school={school.name} level={school.level} account={account.name} fyLabel={fy.label}
      period={monthName(period.month)}
      csvHref={`/app/${accountId}/cash-book/export?month=${month}`}
      landscape
    >
      <BookTabs accountId={accountId} active="cash-book" />
      <MonthPicker accountId={accountId} report="cash-book" periods={periods} active={month} posted={posted} />
      {side("Receipts", cb.receipts, cb.receiptTotals,
        { label: "Balance brought down", balances: cb.opening }, true)}
      {side("Payments", cb.payments, cb.paymentTotals,
        { label: "Balance carried down", balances: cb.closing }, false)}
    </ReportShell>
  );
}
