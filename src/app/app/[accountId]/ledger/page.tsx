import { buildLedger, formatKes } from "@/domain";
import { loadBook } from "@/server/book-context";
import { getTxns } from "@/server/queries";
import { getCurrentPeriod, monthName } from "@/server/periods";
import { BookTabs } from "../book-tabs";

export default async function Page({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const { heads, fy, school, account } = await loadBook(accountId);
  const period = await getCurrentPeriod(fy.id);
  const txns = await getTxns(fy.id);
  const lines = buildLedger(txns, heads);

  const totals = lines.reduce(
    (a, l) => ({ dr: a.dr + l.dr, cr: a.cr + l.cr }),
    { dr: 0, cr: 0 },
  );

  return (
    <>
      <h1>Ledger accounts</h1>
      <p className="sub">
        Year to date, {monthName(period.month)} — {school.name}, {account.name} account
      </p>
      <BookTabs accountId={accountId} active="ledger" />
      <table>
        <thead>
          <tr>
            <th>Vote head</th>
            <th className="n">Received (Cr)</th>
            <th className="n">Spent (Dr)</th>
            <th className="n">Balance</th>
            <th className="n">Used</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.code}>
              <td><span className="code" style={{ marginRight: ".6rem" }}>{l.code}</span>{l.name}</td>
              <td className="n">{formatKes(l.cr)}</td>
              <td className="n">{formatKes(l.dr)}</td>
              <td className="n">{formatKes(l.cr - l.dr)}</td>
              <td className="n" style={{ color: "var(--muted)" }}>
                {l.cr ? `${Math.round((l.dr / l.cr) * 100)}%` : "—"}
              </td>
            </tr>
          ))}
          <tr className="total">
            <td>Total</td>
            <td className="n">{formatKes(totals.cr)}</td>
            <td className="n">{formatKes(totals.dr)}</td>
            <td className="n">{formatKes(totals.cr - totals.dr)}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </>
  );
}
