"use server";

import { revalidatePath } from "next/cache";
import { toCents } from "@/domain";
import { loadBook } from "@/server/book-context";
import { getPeriodForDate } from "@/server/periods";
import { createTransaction } from "@/server/transactions";

export async function postTransfer(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  const { user, fy } = await loadBook(accountId, { write: true, require: "entry.post" });

  const date = String(form.get("date") ?? "");
  const direction = String(form.get("direction") ?? "");
  const chequeNo = String(form.get("chequeNo") ?? "").trim();
  const particulars = String(form.get("particulars") ?? "").trim();
  const amount = toCents(Number(form.get("amount")));

  if (!date) return "Enter the date of the transfer.";
  if (direction !== "to-bank" && direction !== "to-cash") return "Choose which way the money moves.";
  if (!Number.isFinite(amount) || amount <= 0) return "Enter the amount to transfer.";

  const from = direction === "to-bank" ? "cash" : "bank";
  const to = direction === "to-bank" ? "bank" : "cash";
  try {
    const period = await getPeriodForDate(fy.id, date);
    await createTransaction({
      periodId: period.id,
      accountId,
      userId: user.id,
      orgId: user.orgId,
      txn: {
        date,
        kind: "contra",
        particulars: particulars || (from === "cash" ? "Banking" : "Cash drawn from bank"),
        from,
        to,
        amount,
        chequeNo: chequeNo || undefined,
      },
    });
  } catch (e) {
    return e instanceof Error ? e.message : "The transfer could not be posted.";
  }

  revalidatePath(`/app/${accountId}/cash-and-bank`);
  return null;
}
