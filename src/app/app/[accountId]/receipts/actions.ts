"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { allocateCapitationFromAmount, toCents } from "@/domain";
import type { Allocation, VoteHead } from "@/domain";
import { loadBook } from "@/server/book-context";
import { getCurrentPeriod } from "@/server/periods";
import { saveOpeningBalances, saveVoteHeadRates } from "@/server/queries";
import { createTransaction, updateTransaction, type LineRates } from "@/server/transactions";

export async function saveOpeningBalancesAction(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  const { fy } = await loadBook(accountId);

  const cash = Number(form.get("openingCash") || 0);
  const bank = Number(form.get("openingBank") || 0);
  if (!Number.isFinite(cash) || !Number.isFinite(bank)) return "Enter both balances as figures.";

  await saveOpeningBalances(fy.id, toCents(cash), toCents(bank));

  revalidatePath(`/app/${accountId}`, "layout");
  return "Saved.";
}

interface ReadResult {
  error?: string;
  date: string;
  receiptNo: string;
  particulars: string;
  amount: number;
  enrolment: number;
  allocations: Allocation[];
  rates: LineRates;
}

/**
 * Posting and amending read the same form and split it the same way, so a
 * receipt cannot mean one thing when posted and another when corrected.
 */
function readReceiptForm(form: FormData, heads: VoteHead[]): ReadResult {
  const empty = {
    date: "", receiptNo: "", particulars: "", amount: 0,
    enrolment: 0, allocations: [] as Allocation[], rates: {} as LineRates,
  };

  const date = String(form.get("date") ?? "");
  const receiptNo = String(form.get("receiptNo") ?? "").trim();
  const particulars = String(form.get("particulars") ?? "").trim();
  const amount = toCents(Number(form.get("amount")));

  if (!date) return { ...empty, error: "Enter the date of the receipt." };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ...empty, error: "Enter the amount received." };
  }

  const rateList = heads
    .map((h) => ({ voteHeadCode: h.code, perLearner: toCents(Number(form.get(`rate_${h.code}`) || 0)) }))
    .filter((r) => r.perLearner > 0);
  const flatList = heads
    .map((h) => ({ voteHeadCode: h.code, amount: toCents(Number(form.get(`flat_${h.code}`) || 0)) }))
    .filter((f) => f.amount > 0);
  if (!rateList.length && !flatList.length) {
    return { ...empty, error: "Enter at least one rate per learner, or a flat amount, from the circular." };
  }

  // The last head in the chart is the basic/residual vote: the rounding residue
  // falls there so the split equals the disbursement to the cent.
  const basic = { voteHeadCode: heads[heads.length - 1].code };
  const { enrolment, allocations } = allocateCapitationFromAmount(amount, rateList, basic, flatList);
  if (rateList.length && enrolment <= 0) {
    return { ...empty, error: "Nothing is left for the per-learner rates once the flat amounts come off. Check the circular." };
  }

  const rates: LineRates = {};
  for (const h of heads) {
    const perLearner = rateList.find((r) => r.voteHeadCode === h.code)?.perLearner ?? 0;
    const flatAmount = flatList.find((f) => f.voteHeadCode === h.code)?.amount ?? 0;
    if (perLearner || flatAmount) rates[h.code] = { perLearner, flatAmount };
  }

  return { date, receiptNo, particulars, amount, enrolment, allocations, rates };
}

export async function postReceipt(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  const { user, heads, fy } = await loadBook(accountId);

  const r = readReceiptForm(form, heads);
  if (r.error) return r.error;

  const period = await getCurrentPeriod(fy.id);
  await saveVoteHeadRates(fy.id, accountId, r.rates);

  const transactionId = await createTransaction({
    periodId: period.id,
    accountId,
    userId: user.id,
    orgId: user.orgId,
    enrolment: r.enrolment,
    rates: r.rates,
    txn: {
      date: r.date,
      kind: "receipt",
      particulars: r.particulars || `Receipt ${r.receiptNo}`,
      receiptNo: r.receiptNo || undefined,
      cash: 0,
      bank: r.amount,
      allocations: r.allocations,
    },
  });

  revalidatePath(`/app/${accountId}/receipts`);
  redirect(`/app/${accountId}/receipts/${transactionId}/acknowledgement`);
}

export async function amendReceipt(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  const transactionId = String(form.get("transactionId") ?? "");
  const { user, heads } = await loadBook(accountId);

  const r = readReceiptForm(form, heads);
  if (r.error) return r.error;

  try {
    await updateTransaction({
      transactionId,
      accountId,
      userId: user.id,
      orgId: user.orgId,
      enrolment: r.enrolment,
      rates: r.rates,
      txn: {
        date: r.date,
        kind: "receipt",
        particulars: r.particulars || `Receipt ${r.receiptNo}`,
        receiptNo: r.receiptNo || undefined,
        cash: 0,
        bank: r.amount,
        allocations: r.allocations,
      },
    });
  } catch (e) {
    return e instanceof Error ? e.message : "The amendment could not be saved.";
  }

  revalidatePath(`/app/${accountId}`, "layout");
  redirect(`/app/${accountId}/receipts/${transactionId}/acknowledgement`);
}
