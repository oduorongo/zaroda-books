import Link from "next/link";
import { balancesAfter, buildLedger, formatKes } from "@/domain";
import { loadBook } from "@/server/book-context";
import { getTxns } from "@/server/queries";
import { PaymentForm } from "./form";
import { ReportShell } from "../report-shell";

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
    <ReportShell
      title="Payments"
      sub={<>
        {school.name} — {account.name}, FY {fy.label}. Each payment is charged to one or more vote heads,
        each with its own amount, and to either cash or bank.
      </>}
      school={school.name} account={account.name} fyLabel={fy.label}
      csvHref={`/app/${accountId}/payments/export`}
      landscape
    >

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
              <th>Date</th><th>VR no.</th><th>Particulars</th><th>Vote heads</th>
              <th className="n">Cash</th><th className="n">Bank</th><th></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="mono" style={{ color: "var(--muted)" }}>{p.date}</td>
                <td className="mono">{p.kind === "payment" ? p.vrNo ?? "—" : "—"}</td>
                <td>{p.particulars}</td>
                <td>
                  {p.kind === "payment" && p.allocations.length
                    ? p.allocations.map((a) => (
                        <span key={a.voteHeadCode} className="code" style={{ marginRight: ".4rem" }}>
                          {a.voteHeadCode} {formatKes(a.amount)}
                        </span>
                      ))
                    : "—"}
                </td>
                <td className="n">{p.kind === "payment" && p.cash ? formatKes(p.cash) : "—"}</td>
                <td className="n">{p.kind === "payment" && p.bank ? formatKes(p.bank) : "—"}</td>
                <td className="n">
                  <Link className="note" href={`/app/${accountId}/payments/${p.id}/voucher`}>View</Link>
                </td>
              </tr>
            ))}
            <tr className="total">
              <td colSpan={4}>Total paid</td>
              <td className="n">{formatKes(totalCash)}</td>
              <td className="n">{formatKes(totalBank)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </ReportShell>
  );
}
