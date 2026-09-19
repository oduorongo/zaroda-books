import Link from "next/link";
import { formatKes } from "@/domain";
import { loadBook } from "@/server/book-context";
import { getTxns } from "@/server/queries";
import { PrintButton } from "../../print-button";

/**
 * Every voucher of the financial year, one to a page, for printing the year's
 * voucher book in a single run. Ordered by voucher number, which is the date
 * order the sequence is built from.
 */
export default async function VoucherBookPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const { heads, fy, school, account } = await loadBook(accountId);

  const vouchers = (await getTxns(fy.id))
    .filter((t) => t.kind === "payment")
    .sort((a, b) => Number(a.vrNo ?? 0) - Number(b.vrNo ?? 0));

  const nameOf = (code: string) => heads.find((h) => h.code === code)?.name ?? code;

  return (
    <div>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <Link href={`/app/${accountId}/payments`}>← Back to payments</Link>
        <span className="report-actions">
          <PrintButton />
        </span>
      </div>

      <div className="no-print" style={{ marginBottom: "1.5rem" }}>
        <h1>Voucher book — FY {fy.label}</h1>
        <p className="sub">
          {vouchers.length === 0
            ? "No payments posted yet."
            : `${vouchers.length} voucher${vouchers.length === 1 ? "" : "s"}, numbered 1 to ${vouchers.length}. `
              + "Each prints on its own page."}
        </p>
      </div>

      {vouchers.map((txn) => {
        const total = txn.cash + txn.bank;
        return (
          <div key={txn.id} className="voucher-sheet card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
              <div>
                <div className="eyebrow">Payment voucher</div>
                <h2 style={{ margin: ".4rem 0 .2rem" }}>{school.name}</h2>
                <div className="note">{account.name} account · FY {fy.label}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="eyebrow">VR No.</div>
                <div className="mono" style={{ fontSize: "1.9rem", fontWeight: 700, lineHeight: 1.1 }}>
                  {txn.vrNo ?? "—"}
                </div>
              </div>
            </div>

            <table style={{ marginTop: "1.25rem" }}>
              <tbody>
                <tr><td>Date paid</td><td className="n">{txn.date}</td></tr>
                <tr><td>Cheque no.</td><td className="n">{txn.chequeNo ?? "—"}</td></tr>
                <tr><td>Particulars</td><td className="n">{txn.particulars}</td></tr>
                <tr><td>Paid from</td><td className="n">{txn.cash > 0 ? "Cash" : "Bank"}</td></tr>
                <tr><td>Amount paid</td><td className="n">{formatKes(total)}</td></tr>
              </tbody>
            </table>

            <table style={{ marginTop: "1rem" }}>
              <thead><tr><th>Vote head</th><th className="n">Amount</th></tr></thead>
              <tbody>
                {txn.allocations.map((a) => (
                  <tr key={a.voteHeadCode}>
                    <td>
                      <span className="code" style={{ marginRight: ".6rem" }}>{a.voteHeadCode}</span>
                      {nameOf(a.voteHeadCode)}
                    </td>
                    <td className="n">{formatKes(a.amount)}</td>
                  </tr>
                ))}
                <tr className="total"><td>Total</td><td className="n">{formatKes(total)}</td></tr>
              </tbody>
            </table>

            <p className="note" style={{ marginTop: "1.5rem" }}>
              Certified that the goods or services were received and the expenditure is a proper
              charge against the votes shown. Signed ______________________ on ______________.
            </p>
          </div>
        );
      })}
    </div>
  );
}
