import Link from "next/link";
import { notFound } from "next/navigation";
import { formatKes } from "@/domain";
import { loadBook } from "@/server/book-context";
import { queriedEntries } from "@/server/audit-queries";
import { getTxns } from "@/server/queries";
import { PdfButton } from "../../../pdf-button";
import { PrintButton } from "../../../print-button";
import { VoucherAuthorisation, VoucherSignatures } from "../../signatures";
import { paymentStatuses } from "@/server/authorisation";
import { closedMonths, documentsFor } from "@/server/documents";
import { PaymentDocuments } from "../../documents";
import { can } from "@/domain";
import { LevelBand, PoweredBy } from "../../../level-mark";

export default async function VoucherPage({
  params,
}: {
  params: Promise<{ accountId: string; transactionId: string }>;
}) {
  const { accountId, transactionId } = await params;
  const { user, heads, fy, school, account } = await loadBook(accountId);
  const queried = await queriedEntries(accountId);

  const txns = await getTxns(fy.id);
  const txn = txns.find((t) => t.id === transactionId);
  if (!txn || txn.kind !== "payment") notFound();

  const status = (await paymentStatuses(txns)).find((s) => s.payment.id === transactionId)?.status;
  const [docs, closed] = await Promise.all([documentsFor([transactionId]), closedMonths(fy.id)]);
  const nameOf = (code: string) => heads.find((h) => h.code === code)?.name ?? code;
  const total = txn.cash + txn.bank;
  const voucherExport = `/app/${accountId}/payments/${transactionId}/voucher/export`;

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <Link href={`/app/${accountId}/payments`}>← Back to payments</Link>
        <span style={{ display: "flex", gap: "1.1rem", alignItems: "center" }}>
          <Link href={`/app/${accountId}/payments/${transactionId}/edit`}>Amend this payment</Link>
          {queried.has(transactionId) && (
            <Link href={`/app/${accountId}/queries`} style={{ color: "var(--alarm)" }}>⚑ Audit query open</Link>
          )}
          {user.auditing && <Link href={`/app/${accountId}/queries?txn=${transactionId}`}>Raise a query</Link>}
          <span className="report-actions">
            <PdfButton href={voucherExport} />
            <a className="btn btn-quiet" href={voucherExport} download>Download CSV</a>
            <PrintButton />
          </span>
        </span>
      </div>

      <div className={`card level-card level-${school.level}`}>
        <LevelBand level={school.level} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginBottom: "1.75rem" }}>
          <div>
            <div className="eyebrow">Payment voucher</div>
            <h1 style={{ margin: ".6rem 0 .3rem" }}>{school.name}</h1>
            <p className="sub" style={{ margin: 0 }}>{account.name} account · FY {fy.label}</p>
          </div>
          <div className={`vr-box level-${school.level}`}>
            <div className="eyebrow">VR No.</div>
            <div className="mono" style={{ fontSize: "1.9rem", fontWeight: 700, lineHeight: 1.1 }}>
              {txn.vrNo ?? "—"}
            </div>
          </div>
        </div>

        <table>
          <tbody>
            <tr><td>Date paid</td><td className="n">{txn.date}</td></tr>
            <tr><td>Cheque no.</td><td className="n">{txn.chequeNo ?? "—"}</td></tr>
            <tr><td>Payee / paid to</td><td className="n">{txn.particulars}</td></tr>
            {txn.narration && <tr><td>Narration</td><td className="n">{txn.narration}</td></tr>}
            {txn.project && <tr><td>Project</td><td className="n">{txn.project}</td></tr>}
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

        <PaymentDocuments
          accountId={accountId}
          transactionId={transactionId}
          docs={(docs.get(transactionId) ?? []).map((d) => ({
            id: d.id, kind: d.kind, fileName: d.fileName, onPaper: !d.blobPath, addedOn: d.addedAt.toISOString().slice(0, 10),
          }))}
          canAttach={can(user.role, "entry.post") && !user.readOnly}
          canRemove={can(user.role, "entry.amend") && !user.readOnly && !closed.has(txn.date.slice(0, 7))}
        />
        <VoucherAuthorisation status={status} exempt={account.authorisationExempt} />
        <VoucherSignatures />
        <PoweredBy />
      </div>
    </div>
  );
}
