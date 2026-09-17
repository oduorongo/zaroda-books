import { buildLedger, formatKes } from "@/domain";
import { loadBook } from "@/server/book-context";
import { getTxns, upTo } from "@/server/queries";
import { getReportPeriod, monthKey, monthName } from "@/server/periods";
import { BookTabs } from "../book-tabs";
import { MonthPicker } from "../month-picker";
import { ReportShell } from "../report-shell";

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
  const lines = buildLedger(upTo(txns, month), heads);

  const totals = lines.reduce(
    (a, l) => ({ dr: a.dr + l.dr, cr: a.cr + l.cr }),
    { dr: 0, cr: 0 },
  );

  return (
    <ReportShell
      title="Ledger accounts"
      sub={<>Year to date, {monthName(period.month)} — {school.name}, {account.name} account</>}
      school={school.name} account={account.name} fyLabel={fy.label}
      period={`Year to date, ${monthName(period.month)}`}
      csvHref={`/app/${accountId}/ledger/export?month=${month}`}
      landscape
    >
      <BookTabs accountId={accountId} active="ledger" />
      <MonthPicker accountId={accountId} report="ledger" periods={periods} active={month} posted={posted} />
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
    </ReportShell>
  );
}
