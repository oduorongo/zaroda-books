import Link from "next/link";
import { notFound } from "next/navigation";
import { circularsFor, circularYear, LEVEL_LABEL, entryDates, flatOnlyHeadCodes, isCapitationAccount, takesProject, toKes } from "@/domain";
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
  const capitation = isCapitationAccount(school.level, account.type as AccountType);

  return (
    <>
      <div className="no-print" style={{ marginBottom: "1.25rem" }}>
        <Link href={`/app/${accountId}/receipts`}>← Back to receipts</Link>
      </div>

      <h1>Amend receipt</h1>
      <p className="sub">
        {school.name} — {account.name}, FY {fy.label}. The figures below are the ones this receipt
        was posted from. Change what is wrong and save: {capitation
          ? "the enrolment and the split are worked out again from the amended figures, and the acknowledgement reprints."
          : "the vote heads must still add up to the amount received."}
      </p>

      <ReceiptForm
        accountId={accountId}
        heads={heads}
        dates={entryDates(fy, [])}
        circulars={circularsFor(school.level, account.type as AccountType).map((c) => ({
          key: `${c.ref}|${c.date}`,
          label: `${c.programme} ${c.term} — ${c.ref}, ${c.date}`,
          note: c.note,
          year: circularYear(c.date),
          figures: c.accounts[account.type as AccountType]!,
        }))}
        bookYear={fy.label}
        levelLabel={LEVEL_LABEL[school.level]}
        flatOnly={flatOnlyHeadCodes(school.level, account.type as AccountType)}
        capitation={capitation}
        project={takesProject(account.type as AccountType)}
        receipt={{
          id: receipt.id,
          date: receipt.date,
          receiptNo: receipt.receiptNo,
          particulars: receipt.particulars,
          amount: figure(receipt.amount),
          bankedOn: receipt.bankedOn,
          project: receipt.project,
          projectApproval: receipt.projectApproval,
          projectStatus: receipt.projectStatus,
          entries: Object.fromEntries(
            heads.map((h) => [h.code, {
              rate: figure(receipt.rates[h.code]?.perLearner ?? 0),
              flat: figure(receipt.rates[h.code]?.flatAmount ?? 0),
              amount: figure(receipt.amounts[h.code] ?? 0),
            }]),
          ),
        }}
      />

      <DeleteReceipt accountId={accountId} transactionId={receipt.id} />
    </>
  );
}
