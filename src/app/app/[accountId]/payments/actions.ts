"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { toCents } from "@/domain";
import type { Allocation, VoteHead } from "@/domain";
import { loadBook } from "@/server/book-context";
import { getPeriodForDate } from "@/server/periods";
import { createTransaction, deleteTransaction, updateTransaction } from "@/server/transactions";

interface ReadResult {
  error?: string;
  date: string;
  vrNo: string;
  chequeNo: string;
  particulars: string;
  method: string;
  total: number;
  allocations: Allocation[];
}

/**
 * One payment, charged to as many vote heads as it needs. The payment is the
 * sum of its lines rather than a figure of its own, so rule 2 holds by
 * construction.
 */
function readPaymentForm(form: FormData, heads: VoteHead[]): ReadResult {
  const empty = {
    date: "", vrNo: "", chequeNo: "", particulars: "", method: "bank",
    total: 0, allocations: [] as Allocation[],
  };

  const date = String(form.get("date") ?? "");
  const vrNo = String(form.get("vrNo") ?? "").trim();
  const chequeNo = String(form.get("chequeNo") ?? "").trim();
  const particulars = String(form.get("particulars") ?? "").trim();
  const method = String(form.get("method") ?? "bank");

  if (!date) return { ...empty, error: "Enter the date of the payment." };

  const allocations: Allocation[] = [];
  for (const h of heads) {
    const raw = form.get(`amount_${h.code}`);
    if (raw === null || String(raw).trim() === "") continue;
    const amount = toCents(Number(raw));
    if (!Number.isFinite(amount)) return { ...empty, error: `Enter ${h.code} as a figure.` };
    if (amount < 0) return { ...empty, error: `A payment cannot be negative. Check ${h.code}.` };
    if (amount > 0) allocations.push({ voteHeadCode: h.code, amount });
  }
  if (!allocations.length) {
    return { ...empty, error: "Enter an amount against at least one vote head." };
  }

  const total = allocations.reduce((a, x) => a + x.amount, 0);
  return { date, vrNo, chequeNo, particulars, method, total, allocations };
}

export async function postPayment(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  const { user, heads, fy } = await loadBook(accountId, { write: true });

  const p = readPaymentForm(form, heads);
  if (p.error) return p.error;

  try {
    const period = await getPeriodForDate(fy.id, p.date);
    await createTransaction({
      periodId: period.id,
      accountId,
      userId: user.id,
      orgId: user.orgId,
      txn: {
        date: p.date,
        kind: "payment",
        particulars: p.particulars || `Payment ${p.vrNo}`,
        vrNo: p.vrNo || undefined,
        chequeNo: p.chequeNo || undefined,
        cash: p.method === "cash" ? p.total : 0,
        bank: p.method === "bank" ? p.total : 0,
        allocations: p.allocations,
      },
    });
  } catch (e) {
    return e instanceof Error ? e.message : "The payment could not be posted.";
  }

  revalidatePath(`/app/${accountId}/payments`);
  return null;
}

export async function amendPayment(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  const transactionId = String(form.get("transactionId") ?? "");
  const { user, heads } = await loadBook(accountId, { write: true });

  const p = readPaymentForm(form, heads);
  if (p.error) return p.error;

  try {
    await updateTransaction({
      transactionId,
      accountId,
      userId: user.id,
      orgId: user.orgId,
      txn: {
        date: p.date,
        kind: "payment",
        particulars: p.particulars || `Payment ${p.vrNo}`,
        vrNo: p.vrNo || undefined,
        chequeNo: p.chequeNo || undefined,
        cash: p.method === "cash" ? p.total : 0,
        bank: p.method === "bank" ? p.total : 0,
        allocations: p.allocations,
      },
    });
  } catch (e) {
    return e instanceof Error ? e.message : "The amendment could not be saved.";
  }

  revalidatePath(`/app/${accountId}`, "layout");
  redirect(`/app/${accountId}/payments`);
}

export async function deletePayment(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  const transactionId = String(form.get("transactionId") ?? "");
  const { user } = await loadBook(accountId, { write: true });

  try {
    await deleteTransaction({ transactionId, accountId, userId: user.id, orgId: user.orgId });
  } catch (e) {
    return e instanceof Error ? e.message : "The payment could not be deleted.";
  }

  revalidatePath(`/app/${accountId}`, "layout");
  redirect(`/app/${accountId}/payments`);
}
