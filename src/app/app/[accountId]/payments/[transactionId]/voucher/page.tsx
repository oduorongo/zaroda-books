import Link from "next/link";
import { notFound } from "next/navigation";
import { formatKes } from "@/domain";
import { loadBook } from "@/server/book-context";
import { getTxns } from "@/server/queries";
import { PdfButton } from "../../../pdf-button";
import { PrintButton } from "../../../print-button";
import { VoucherSignatures } from "../../signatures";

export default async function VoucherPage({
  params,
}: {
  params: Promise<{ accountId: string; transactionId: string }>;
}) {
  const { accountId, transactionId } = await params;
  const { heads, fy, school, account } = await loadBook(accountId);

  const txn = (await getTxns(fy.id)).find((t) => t.id === transactionId);
  if (!txn || txn.kind !== "payment") notFound();

  const nameOf = (code: string) => heads.find((h) => h.code === code)?.name ?? code;
  const total = txn.cash + txn.bank;
  const voucherExport = `/app/${accountId}/payments/${transactionId}/voucher/export`;

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <Link href={`/app/${accountId}/payments`}>← Back to payments</Link>
        <span style={{ display: "flex", gap: "1.1rem", alignItems: "center" }}>
          <Link href={`/app/${accountId}/payments/${transactionId}/edit`}>Amend this payment</Link>
          <span className="report-actions">
            <PdfButton href={voucherExport} />
            <a className="btn btn-quiet" href={voucherExport} download>Download CSV</a>
            <PrintButton />
          </span>
        </span>
      </div>

      <div className="card">
        <div className="eyebrow">Payment voucher</div>
        <h1 style={{ marginTop: ".6rem" }}>{school.name}</h1>
        <p className="sub" style={{ marginBottom: "1.75rem" }}>
          {account.name} account · FY {fy.label}
        </p>

        <table>
          <tbody>
            <tr><td>Date paid</td><td className="n">{txn.date}</td></tr>
            <tr><td>Voucher no.</td><td className="n">{txn.vrNo ?? "—"}</td></tr>
            <tr><td>Cheque no.</td><td className="n">{txn.chequeNo ?? "—"}</td></tr>
            <tr><td>Payee / paid to</td><td className="n">{txn.particulars}</td></tr>
            {txn.narration && <tr><td>Narration</td><td className="n">{txn.narration}</td></tr>}
            <tr><td>Paid from</td><td className="n">{txn.cash > 0 ? "Cash" : "Bank"}</td></tr>
            <tr><td>Amount paid</td><td className="n">{formatKes(total)}</td></tr>
          </tbody>
        </table>

        <h2>Charged to</h2>
        <table>
          <thead>
            <tr><th>Vote head</th><th className="n">Amount</th></tr>
          </thead>
          <tbody>
            {txn.allocations.map((a) => (
              <tr key={a.voteHeadCode}>
                <td><span className="code" style={{ marginRight: ".6rem" }}>{a.voteHeadCode}</span>{nameOf(a.voteHeadCode)}</td>
                <td className="n">{formatKes(a.amount)}</td>
              </tr>
            ))}
            <tr className="total">
              <td>Total</td>
              <td className="n">{formatKes(total)}</td>
            </tr>
          </tbody>
        </table>

        <VoucherSignatures />
      </div>
    </div>
  );
}
