import Link from "next/link";
import { notFound } from "next/navigation";
import { entryDates, flatOnlyHeadCodes, toKes } from "@/domain";
import type { AccountType } from "@/domain";
import { loadBook } from "@/server/book-context";
import { getReceiptForEdit } from "@/server/queries";
import { DeleteReceipt } from "../../delete-button";
import { ReceiptForm } from "../../form";

export default async function AmendReceiptPage({
  params,
}: {
  params: Promise<{ accountId: string; transactionId: string }>;
}) {
  const { accountId, transactionId } = await params;
  const { heads, fy, school, account } = await loadBook(accountId);

  const receipt = await getReceiptForEdit(transactionId, accountId);
  if (!receipt) notFound();

  const figure = (cents: number) => (cents ? String(toKes(cents)) : "");

  return (
    <>
      <div className="no-print" style={{ marginBottom: "1.25rem" }}>
        <Link href={`/app/${accountId}/receipts`}>← Back to receipts</Link>
      </div>

      <h1>Amend receipt</h1>
      <p className="sub">
        {school.name} — {account.name}, FY {fy.label}. The figures below are the ones this receipt
        was posted from. Change what is wrong and save: the enrolment and the split are worked out
        again from the amended figures, and the acknowledgement reprints.
      </p>

      <ReceiptForm
        accountId={accountId}
        heads={heads}
        dates={entryDates(fy, [])}
        flatOnly={flatOnlyHeadCodes(school.level, account.type as AccountType)}
        receipt={{
          id: receipt.id,
          date: receipt.date,
          receiptNo: receipt.receiptNo,
          particulars: receipt.particulars,
          amount: figure(receipt.amount),
          bankedOn: receipt.bankedOn,
          entries: Object.fromEntries(
            heads.map((h) => [h.code, {
              rate: figure(receipt.rates[h.code]?.perLearner ?? 0),
              flat: figure(receipt.rates[h.code]?.flatAmount ?? 0),
            }]),
          ),
        }}
      />

      <DeleteReceipt accountId={accountId} transactionId={receipt.id} />
    </>
  );
}
