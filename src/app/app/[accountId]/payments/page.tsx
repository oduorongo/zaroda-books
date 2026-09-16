import { balancesAfter, buildLedger, formatKes } from "@/domain";
import { loadBook } from "@/server/book-context";
import { getTxns } from "@/server/queries";
import { PaymentForm } from "./form";

export default async function PaymentsPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const { heads, fy, school, account } = await loadBook(accountId);
  const txns = await getTxns(fy.id);

  const balances = Object.fromEntries(
    buildLedger(txns, heads).map((l) => [l.code, l.cr - l.dr]),
  );
  const payments = txns
    .filter((t) => t.kind === "payment")
    .sort((a, b) => a.date.localeCompare(b.date));
  const totalCash = payments.reduce((a, p) => a + (p.kind === "payment" ? p.cash : 0), 0);
  const totalBank = payments.reduce((a, p) => a + (p.kind === "payment" ? p.bank : 0), 0);

  return (
    <>
      <h1>Payments</h1>
      <p className="sub">
        {school.name} — {account.name}, FY {fy.label}. Each payment is charged to one vote head and
        to either cash or bank.
      </p>

      <PaymentForm
        accountId={accountId}
        heads={heads}
        balances={balances}
        cashInHand={balancesAfter({ cash: fy.openingCash, bank: fy.openingBank }, txns).cash}
      />

      <div className="card" style={{ marginTop: "1.6rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Payments recorded</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th><th>VR no.</th><th>Particulars</th><th>Vote head</th>
              <th className="n">Cash</th><th className="n">Bank</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="mono" style={{ color: "var(--muted)" }}>{p.date}</td>
                <td className="mono">{p.kind === "payment" ? p.vrNo ?? "—" : "—"}</td>
                <td>{p.particulars}</td>
                <td><span className="code">{p.kind === "payment" ? p.allocations[0]?.voteHeadCode ?? "—" : "—"}</span></td>
                <td className="n">{p.kind === "payment" && p.cash ? formatKes(p.cash) : "—"}</td>
                <td className="n">{p.kind === "payment" && p.bank ? formatKes(p.bank) : "—"}</td>
              </tr>
            ))}
            <tr className="total">
              <td colSpan={4}>Total paid</td>
              <td className="n">{formatKes(totalCash)}</td>
              <td className="n">{formatKes(totalBank)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
