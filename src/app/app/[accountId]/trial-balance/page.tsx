import { buildTrialBalance, formatKes } from "@/domain";
import { loadBook } from "@/server/book-context";
import { getTxns, upTo } from "@/server/queries";
import { getReportPeriod, monthKey, monthName } from "@/server/periods";
import { BookTabs } from "../book-tabs";
import { MonthPicker } from "../month-picker";

export default async function Page({ params, searchParams }: {
  params: Promise<{ accountId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { accountId } = await params;
  const { month: asked } = await searchParams;
  const { heads, fy, school, account } = await loadBook(accountId);
  const txns = await getTxns(fy.id);
  const { period, periods } = await getReportPeriod(fy.id, txns, asked);
  const posted = new Set(txns.map((t) => t.date.slice(0, 7)));
  const tb = buildTrialBalance(
    monthName(period.month),
    { cash: fy.openingCash, bank: fy.openingBank },
    upTo(txns, monthKey(period.month)),
    heads,
  );

  return (
    <>
      <h1>Trial balance as at {tb.asAt}</h1>
      <p className="sub">{school.name} &mdash; {account.name} account</p>
      <BookTabs accountId={accountId} active="trial-balance" />
      <MonthPicker accountId={accountId} report="trial-balance" periods={periods} active={monthKey(period.month)} posted={posted} />
      <table>
        <thead>
          <tr><th>Details</th><th className="n">Dr</th><th className="n">Cr</th></tr>
        </thead>
        <tbody>
          <tr className="carry"><td>Balance brought down &mdash; cash</td><td className="n" /><td className="n">{formatKes(tb.openingCash)}</td></tr>
          <tr className="carry"><td>Balance brought down &mdash; bank</td><td className="n" /><td className="n">{formatKes(tb.openingBank)}</td></tr>
          {tb.lines.map((l) => (
            <tr key={l.code}>
              <td>{l.name}</td>
              <td className="n">{formatKes(l.dr)}</td>
              <td className="n">{formatKes(l.cr)}</td>
            </tr>
          ))}
          <tr className="carry"><td>Balance carried down &mdash; cash</td><td className="n">{formatKes(tb.closingCash)}</td><td className="n" /></tr>
          <tr className="carry"><td>Balance carried down &mdash; bank</td><td className="n">{formatKes(tb.closingBank)}</td><td className="n" /></tr>
          <tr className="total">
            <td>Total</td>
            <td className="n">{formatKes(tb.totalDr)}</td>
            <td className="n">{formatKes(tb.totalCr)}</td>
          </tr>
        </tbody>
      </table>
      <p className={`verdict ${tb.balanced ? "ok" : "off"}`}>
        {tb.balanced
          ? "The book balances. This month can be closed."
          : `Out by ${formatKes(tb.difference)}. Find the entry before closing.`}
      </p>
    </>
  );
}
