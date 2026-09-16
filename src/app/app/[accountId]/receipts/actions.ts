"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { allocateCapitationFromAmount, toCents } from "@/domain";
import { loadBook } from "@/server/book-context";
import { getCurrentPeriod } from "@/server/periods";
import { saveOpeningBalances, saveVoteHeadRates } from "@/server/queries";
import { createTransaction } from "@/server/transactions";

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

export async function postReceipt(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  const { user, heads, fy } = await loadBook(accountId);

  const date = String(form.get("date") ?? "");
  const receiptNo = String(form.get("receiptNo") ?? "").trim();
  const particulars = String(form.get("particulars") ?? "").trim();
  const amount = toCents(Number(form.get("amount")));

  if (!date) return "Enter the date of the receipt.";
  if (!Number.isFinite(amount) || amount <= 0) return "Enter the amount received.";

  const rates = heads
    .map((h) => ({ voteHeadCode: h.code, perLearner: toCents(Number(form.get(`rate_${h.code}`) || 0)) }))
    .filter((r) => r.perLearner > 0);
  const flats = heads
    .map((h) => ({ voteHeadCode: h.code, amount: toCents(Number(form.get(`flat_${h.code}`) || 0)) }))
    .filter((f) => f.amount > 0);
  if (!rates.length && !flats.length) {
    return "Enter at least one rate per learner, or a flat amount, from the circular.";
  }

  // The last head in the chart is the basic/residual vote: the rounding residue
  // falls there so the split equals the disbursement to the cent.
  const basic = { voteHeadCode: heads[heads.length - 1].code };
  const { enrolment, allocations } = allocateCapitationFromAmount(amount, rates, basic, flats);
  if (rates.length && enrolment <= 0) {
    return "Nothing is left for the per-learner rates once the flat amounts come off. Check the circular.";
  }

  const period = await getCurrentPeriod(fy.id);

  const byCode: Record<string, { perLearner: number; flatAmount: number }> = {};
  for (const h of heads) {
    const perLearner = rates.find((r) => r.voteHeadCode === h.code)?.perLearner ?? 0;
    const flatAmount = flats.find((f) => f.voteHeadCode === h.code)?.amount ?? 0;
    if (perLearner || flatAmount) byCode[h.code] = { perLearner, flatAmount };
  }
  await saveVoteHeadRates(fy.id, accountId, byCode);

  const transactionId = await createTransaction({
    periodId: period.id,
    accountId,
    userId: user.id,
    orgId: user.orgId,
    enrolment,
    txn: {
      date,
      kind: "receipt",
      particulars: particulars || `Receipt ${receiptNo}`,
      receiptNo: receiptNo || undefined,
      cash: 0,
      bank: amount,
      allocations,
    },
  });

  revalidatePath(`/app/${accountId}/receipts`);
  redirect(`/app/${accountId}/receipts/${transactionId}/acknowledgement`);
}
