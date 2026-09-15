import { buildTrialBalance, formatKes } from "@/domain";
import { getVoteHeads, getFinancialYear, getTxns, upTo } from "@/server/queries";
import { Tabs } from "../tabs";

const AS_AT = "2026-05";

export default async function Page({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const heads = await getVoteHeads(accountId);
  const fy = await getFinancialYear(accountId);
  const opening = { cash: fy.openingCash, bank: fy.openingBank };
  const txns = await getTxns(fy.id);
  const tb = buildTrialBalance("31 May 2026", opening, upTo(txns, AS_AT), heads);

  return (
    <main>
      <h1>Trial balance as at {tb.asAt}</h1>
      <p className="sub">Ong&rsquo;ora Kakuru Primary School &mdash; SIMBA account</p>
      <Tabs accountId={accountId} active="trial-balance" />
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
    </main>
  );
}
