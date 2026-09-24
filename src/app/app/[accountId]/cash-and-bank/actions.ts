"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { toCents } from "@/domain";
import type { NewTxn } from "@/domain";
import { loadBook } from "@/server/book-context";
import { getPeriodForDate } from "@/server/periods";
import { getTransferForEdit } from "@/server/queries";
import { createTransaction, deleteTransaction, updateTransaction } from "@/server/transactions";

/**
 * Posting and amending read the same form, so a transfer cannot mean one thing
 * when posted and another when corrected.
 */
function readTransferForm(form: FormData): { error: string } | { txn: NewTxn } {
  const date = String(form.get("date") ?? "");
  const direction = String(form.get("direction") ?? "");
  const chequeNo = String(form.get("chequeNo") ?? "").trim();
  const particulars = String(form.get("particulars") ?? "").trim();
  const amount = toCents(Number(form.get("amount")));

  if (!date) return { error: "Enter the date of the transfer." };
  if (direction !== "to-bank" && direction !== "to-cash") return { error: "Choose which way the money moves." };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter the amount to transfer." };

  const from = direction === "to-bank" ? "cash" : "bank";
  const to = direction === "to-bank" ? "bank" : "cash";
  return {
    txn: {
      date,
      kind: "contra",
      particulars: particulars || (from === "cash" ? "Banking" : "Cash drawn from bank"),
      from,
      to,
      amount,
      chequeNo: chequeNo || undefined,
    },
  };
}

/**
 * A transfer a receipt made when it was posted as banked belongs to that
 * receipt: changing it here would leave the two disagreeing.
 */
const BANKED_WITH_RECEIPT =
  "This banking was made by its receipt. Amend the receipt instead — untick Banked or change the date banked there.";

export async function postTransfer(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  const { user, fy } = await loadBook(accountId, { write: true, require: "entry.post" });

  const r = readTransferForm(form);
  if ("error" in r) return r.error;

  try {
    const period = await getPeriodForDate(fy.id, r.txn.date);
    await createTransaction({
      periodId: period.id,
      accountId,
      userId: user.id,
      orgId: user.orgId,
      txn: r.txn,
    });
  } catch (e) {
    return e instanceof Error ? e.message : "The transfer could not be posted.";
  }

  revalidatePath(`/app/${accountId}/cash-and-bank`);
  return null;
}

export async function amendTransfer(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  const transactionId = String(form.get("transactionId") ?? "");
  const { user, fy } = await loadBook(accountId, { write: true, require: "entry.amend" });

  const transfer = await getTransferForEdit(transactionId, fy.id);
  if (!transfer) return "Transfer not found.";
  if (transfer.bankedFrom) return BANKED_WITH_RECEIPT;

  const r = readTransferForm(form);
  if ("error" in r) return r.error;

  try {
    await updateTransaction({ transactionId, accountId, userId: user.id, orgId: user.orgId, txn: r.txn });
  } catch (e) {
    return e instanceof Error ? e.message : "The amendment could not be saved.";
  }

  revalidatePath(`/app/${accountId}`, "layout");
  redirect(`/app/${accountId}/cash-and-bank`);
}

export async function deleteTransfer(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  const transactionId = String(form.get("transactionId") ?? "");
  const { user, fy } = await loadBook(accountId, { write: true, require: "entry.delete" });

  const transfer = await getTransferForEdit(transactionId, fy.id);
  if (!transfer) return "Transfer not found.";
  if (transfer.bankedFrom) return BANKED_WITH_RECEIPT;

  try {
    await deleteTransaction({ transactionId, accountId, userId: user.id, orgId: user.orgId });
  } catch (e) {
    return e instanceof Error ? e.message : "The transfer could not be deleted.";
  }

  revalidatePath(`/app/${accountId}`, "layout");
  redirect(`/app/${accountId}/cash-and-bank`);
}
