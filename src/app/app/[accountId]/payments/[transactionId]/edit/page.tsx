import Link from "next/link";
import { notFound } from "next/navigation";
import { balancesAfter, buildLedger, toKes } from "@/domain";
import { loadBook } from "@/server/book-context";
import { getPaymentForEdit, getTxns } from "@/server/queries";
import { DeletePayment } from "../../delete-button";
import { PaymentForm } from "../../form";

export default async function AmendPaymentPage({
  params,
}: {
  params: Promise<{ accountId: string; transactionId: string }>;
}) {
  const { accountId, transactionId } = await params;
  const { heads, fy, school, account } = await loadBook(accountId);

  const [payment, txns] = await Promise.all([
    getPaymentForEdit(transactionId, accountId),
    getTxns(fy.id),
  ]);
  if (!payment) notFound();

  // The vote balances shown must exclude this payment's own lines, or amending
  // it would look like it overdraws the votes it is already charged to.
  const others = txns.filter((t) => t.id !== transactionId);
  const balances = Object.fromEntries(
    buildLedger(others, heads).map((l) => [l.code, l.cr - l.dr]),
  );

  return (
    <>
      <div className="no-print" style={{ marginBottom: "1.25rem" }}>
        <Link href={`/app/${accountId}/payments`}>← Back to payments</Link>
      </div>

      <h1>Amend payment</h1>
      <p className="sub">
        {school.name} — {account.name}, FY {fy.label}. Change what is wrong and save. The vote
        balances shown leave this payment out, so they read as they will once it is saved again.
      </p>

      <PaymentForm
        accountId={accountId}
        heads={heads}
        balances={balances}
        cashInHand={balancesAfter({ cash: fy.openingCash, bank: fy.openingBank }, others).cash}
        payment={{
          id: payment.id,
          date: payment.date,
          vrNo: payment.vrNo,
          chequeNo: payment.chequeNo,
          particulars: payment.particulars,
          method: payment.method,
          amounts: Object.fromEntries(
            heads.map((h) => [h.code, payment.amounts[h.code] ? String(toKes(payment.amounts[h.code])) : ""]),
          ),
        }}
      />

      <DeletePayment accountId={accountId} transactionId={payment.id} />
    </>
  );
}
