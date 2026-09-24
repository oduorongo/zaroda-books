import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { balancesAfter, toKes } from "@/domain";
import { loadBook } from "@/server/book-context";
import { getTransferForEdit, getTxns } from "@/server/queries";
import { DeleteTransfer, TransferForm } from "../../form";

export default async function AmendTransferPage({
  params,
}: {
  params: Promise<{ accountId: string; transactionId: string }>;
}) {
  const { accountId, transactionId } = await params;
  const { fy, school, account } = await loadBook(accountId);

  const [transfer, txns] = await Promise.all([
    getTransferForEdit(transactionId, fy.id),
    getTxns(fy.id),
  ]);
  if (!transfer) notFound();
  // A receipt's own banking is amended through the receipt.
  if (transfer.bankedFrom) redirect(`/app/${accountId}/receipts/${transfer.bankedFrom}/edit`);

  // The balances shown leave this transfer out, so they read as they will once
  // it is saved again.
  const others = txns.filter((t) => t.id !== transactionId);
  const balances = balancesAfter({ cash: fy.openingCash, bank: fy.openingBank }, others);

  return (
    <>
      <div className="no-print" style={{ marginBottom: "1.25rem" }}>
        <Link href={`/app/${accountId}/cash-and-bank`}>← Back to cash and bank</Link>
      </div>

      <h1>Amend transfer</h1>
      <p className="sub">
        {school.name} — {account.name}, FY {fy.label}. Change what is wrong and save, or delete a
        transfer that was posted in error or entered more than once.
      </p>

      <TransferForm
        accountId={accountId}
        cash={balances.cash}
        bank={balances.bank}
        transfer={{
          id: transfer.id,
          date: transfer.date,
          direction: transfer.from === "cash" ? "to-bank" : "to-cash",
          amount: String(toKes(transfer.amount)),
          chequeNo: transfer.chequeNo,
          particulars: transfer.particulars,
        }}
      />

      <DeleteTransfer accountId={accountId} transactionId={transfer.id} />
    </>
  );
}
