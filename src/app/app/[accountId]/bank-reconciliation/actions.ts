"use server";

import { revalidatePath } from "next/cache";
import { toCents } from "@/domain";
import { loadBook } from "@/server/book-context";
import { saveStatementBalance, setCleared } from "@/server/reconciliation";
import { closeMonth, reopenMonth } from "@/server/period-close";
import { attachBankStatement, removeBankStatement } from "@/server/documents";

export async function saveStatement(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  const periodId = String(form.get("periodId") ?? "");
  const { fy } = await loadBook(accountId, { write: true, require: "entry.amend" });

  const raw = String(form.get("statementBank") ?? "").trim();
  if (!raw) return "Enter the closing balance shown on the bank statement.";
  const balance = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(balance)) return "Enter the closing balance as a figure.";

  // Left blank, the statement is taken as dated the last day of the year.
  const statementDate = String(form.get("statementDate") ?? "").trim() || fy.endsOn;

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

export async function attachStatementAction(_prev: string | null, form: FormData): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return "Choose the statement to attach.";
  try {
    await attachBankStatement(accountId, {
      kind: String(form.get("kind") ?? "statement"),
      from: String(form.get("from") ?? ""),
      to: String(form.get("to") ?? ""),
      file,
    });
  } catch (e) {
    return e instanceof Error ? e.message : "The statement could not be attached.";
  }
  revalidatePath(`/app/${accountId}`, "layout");
  return null;
}

export async function removeStatementAction(_prev: string | null, form: FormData): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  try {
    await removeBankStatement(accountId, String(form.get("statementId") ?? ""));
  } catch (e) {
    return e instanceof Error ? e.message : "The statement could not be removed.";
  }
  revalidatePath(`/app/${accountId}`, "layout");
  return null;
}
