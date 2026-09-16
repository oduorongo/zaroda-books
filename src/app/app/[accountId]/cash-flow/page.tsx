import { buildCashFlow, formatKes } from "@/domain";
import { loadBook } from "@/server/book-context";
import { getTxns, upTo } from "@/server/queries";
import { getCurrentPeriod, monthKey, monthName } from "@/server/periods";
import { BookTabs } from "../book-tabs";

export default async function Page({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const { fy, school, account } = await loadBook(accountId);
  const period = await getCurrentPeriod(fy.id);
  const txns = await getTxns(fy.id);
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
    <>
      <h1>Cash flow statement</h1>
      <p className="sub">
        Year to date, {cf.asAt} — {school.name}, {account.name} account
      </p>
      <BookTabs accountId={accountId} active="cash-flow" />

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
    </>
  );
}
