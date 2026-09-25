"use server";

import { revalidatePath } from "next/cache";
import { toCents } from "@/domain";
import { loadBook } from "@/server/book-context";
import { saveStatementBalance, setCleared } from "@/server/reconciliation";
import { closeMonth, reopenMonth } from "@/server/period-close";

export async function saveStatement(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  const periodId = String(form.get("periodId") ?? "");
  await loadBook(accountId, { write: true, require: "entry.amend" });

  const raw = String(form.get("statementBank") ?? "").trim();
  if (!raw) return "Enter the closing balance shown on the bank statement.";
  const balance = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(balance)) return "Enter the closing balance as a figure.";

  const statementDate = String(form.get("statementDate") ?? "").trim() || null;

  try {
    await saveStatementBalance(periodId, accountId, toCents(balance), statementDate);
  } catch (e) {
    return e instanceof Error ? e.message : "The statement balance could not be saved.";
  }

  revalidatePath(`/app/${accountId}/bank-reconciliation`);
  return null;
}

export async function toggleCleared(form: FormData): Promise<void> {
  const accountId = String(form.get("accountId") ?? "");
  const transactionId = String(form.get("transactionId") ?? "");
  const clearedOn = String(form.get("clearedOn") ?? "").trim();
  await loadBook(accountId, { write: true, require: "entry.amend" });

  await setCleared(transactionId, accountId, clearedOn || null);
  revalidatePath(`/app/${accountId}/bank-reconciliation`);
}

export async function closeMonthAction(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  try {
    await closeMonth(accountId, String(form.get("month") ?? ""));
  } catch (e) {
    return e instanceof Error ? e.message : "The month could not be closed.";
  }
  revalidatePath(`/app/${accountId}`, "layout");
  return null;
}

export async function reopenMonthAction(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  try {
    await reopenMonth(accountId, String(form.get("month") ?? ""), String(form.get("reason") ?? ""));
  } catch (e) {
    return e instanceof Error ? e.message : "The month could not be reopened.";
  }
  revalidatePath(`/app/${accountId}`, "layout");
  return null;
}
