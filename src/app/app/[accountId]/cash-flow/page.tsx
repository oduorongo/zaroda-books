import { buildCashFlow, formatKes } from "@/domain";
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
  const { fy, school, account } = await loadBook(accountId);
  const txns = await getTxns(fy.id);
  const { period, periods } = await getReportPeriod(fy.id, txns, asked);
  const posted = new Set(txns.map((t) => t.date.slice(0, 7)));
  const cf = buildCashFlow(
    monthName(period.month),
    { cash: fy.openingCash, bank: fy.openingBank },
    upTo(txns, monthKey(period.month)),
  );

  const rows = [
    ["Opening balance brought forward", formatKes(cf.openingTotal)],
    ["Receipts — capitation and other income", formatKes(cf.receipts)],
    ["Payments — bank", `(${formatKes(cf.paymentsBank)})`],
    ["Payments — cash", `(${formatKes(cf.paymentsCash)})`],
  ];

  return (
    <ReportShell
      title="Cash flow statement"
      sub={<>Year to date, {cf.asAt} — {school.name}, {account.name} account</>}
      school={school.name} level={school.level} account={account.name} fyLabel={fy.label}
      period={`Year to date, ${cf.asAt}`}
      csvHref={`/app/${accountId}/cash-flow/export?month=${monthKey(period.month)}`}
    >
      <BookTabs accountId={accountId} active="cash-flow" />
      <MonthPicker accountId={accountId} report="cash-flow" periods={periods} active={monthKey(period.month)} posted={posted} />

      <div className="card" style={{ maxWidth: 720 }}>
        <table>
          <tbody>
            {rows.map(([name, amount]) => (
              <tr key={name}>
                <td>{name}</td>
                <td className="n">{amount}</td>
              </tr>
            ))}
            <tr className="total">
              <td>Closing balance — cash and bank</td>
              <td className="n">{formatKes(cf.closingTotal)}</td>
            </tr>
          </tbody>
        </table>

        <div className="grid-2" style={{ marginTop: "1.5rem" }}>
          <div style={{ border: "1px solid var(--rule-card)", borderRadius: 4, padding: "1rem 1.1rem" }}>
            <div className="note" style={{ marginBottom: ".35rem" }}>Cash at hand</div>
            <div className="mono" style={{ fontSize: "1.2rem" }}>{formatKes(cf.closingCash)}</div>
          </div>
          <div style={{ border: "1px solid var(--rule-card)", borderRadius: 4, padding: "1rem 1.1rem" }}>
            <div className="note" style={{ marginBottom: ".35rem" }}>Balance at bank</div>
            <div className="mono" style={{ fontSize: "1.2rem" }}>{formatKes(cf.closingBank)}</div>
          </div>
        </div>
      </div>
    </ReportShell>
  );
}
