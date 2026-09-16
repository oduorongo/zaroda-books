"use server";

import { revalidatePath } from "next/cache";
import { toCents } from "@/domain";
import { loadBook } from "@/server/book-context";
import { getCurrentPeriod } from "@/server/periods";
import { createTransaction } from "@/server/transactions";

export async function postPayment(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  const { user, heads, fy } = await loadBook(accountId);

  const date = String(form.get("date") ?? "");
  const vrNo = String(form.get("vrNo") ?? "").trim();
  const chequeNo = String(form.get("chequeNo") ?? "").trim();
  const particulars = String(form.get("particulars") ?? "").trim();
  const code = String(form.get("voteHead") ?? "");
  const method = String(form.get("method") ?? "bank");
  const amount = toCents(Number(form.get("amount")));

  if (!date) return "Enter the date of the payment.";
  if (!Number.isFinite(amount) || amount <= 0) return "Enter the amount paid.";
  if (!heads.some((h) => h.code === code)) return "Choose the vote head to charge.";

  const period = await getCurrentPeriod(fy.id);

  await createTransaction({
    periodId: period.id,
    accountId,
    userId: user.id,
    orgId: user.orgId,
    txn: {
      date,
      kind: "payment",
      particulars: particulars || `Payment ${vrNo}`,
      vrNo: vrNo || undefined,
      chequeNo: chequeNo || undefined,
      cash: method === "cash" ? amount : 0,
      bank: method === "bank" ? amount : 0,
      allocations: [{ voteHeadCode: code, amount }],
    },
  });

  revalidatePath(`/app/${accountId}/payments`);
  return null;
}
