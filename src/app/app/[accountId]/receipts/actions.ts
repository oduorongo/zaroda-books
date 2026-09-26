"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  allocateCapitationFromAmount, flatOnlyHeadCodes, isCapitationAccount, readProject, residualHeadCode,
  takesProject, toCents, type ReceiptProject,
} from "@/domain";
import type { AccountType } from "@/domain";
import type { Allocation, VoteHead } from "@/domain";
import { loadBook } from "@/server/book-context";
import { getPeriodForDate } from "@/server/periods";
import { saveOpeningBalances, saveVoteHeadRates } from "@/server/queries";
import { createTransaction, deleteTransaction, updateReceiptProject, updateTransaction, type LineRates } from "@/server/transactions";

export async function saveOpeningBalancesAction(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  const { fy } = await loadBook(accountId, { write: true, require: "openingBalances.set" });

  const cash = Number(form.get("openingCash") || 0);
  const bank = Number(form.get("openingBank") || 0);
  if (!Number.isFinite(cash) || !Number.isFinite(bank)) return "Enter both balances as figures.";

  try {
    await saveOpeningBalances(fy.id, toCents(cash), toCents(bank));
  } catch (e) {
    return e instanceof Error ? e.message : "The opening balances could not be saved.";
  }

  revalidatePath(`/app/${accountId}`, "layout");
  return "Saved.";
}

interface ReadResult {
  error?: string;
  date: string;
  receiptNo: string;
  particulars: string;
  amount: number;
  /** Undefined on an account funded per vote head: there is no enrolment to derive. */
  enrolment?: number;
  allocations: Allocation[];
  rates: LineRates;
  /** null when the money stays in the cash box rather than being banked. */
  banking: { date: string } | null;
  /** The project an infrastructure receipt funds. */
  project?: ReceiptProject;
}

/**
 * Posting and amending read the same form and split it the same way, so a
 * receipt cannot mean one thing when posted and another when corrected.
 */
function readReceiptForm(
  form: FormData,
  heads: VoteHead[],
  flatOnly: string[],
  capitation: boolean,
  needsProject: boolean,
): ReadResult {
  const empty = {
    date: "", receiptNo: "", particulars: "", amount: 0,
    enrolment: 0, allocations: [] as Allocation[], rates: {} as LineRates,
    banking: null,
  };

  const date = String(form.get("date") ?? "");
  const receiptNo = String(form.get("receiptNo") ?? "").trim();
  const particulars = String(form.get("particulars") ?? "").trim();
  const amount = toCents(Number(form.get("amount")));

  if (!date) return { ...empty, error: "Enter the date of the receipt." };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ...empty, error: "Enter the amount received." };
  }

  // The money is received in cash and banked; the tick comes off only for a
  // receipt that stays in the cash box.
  const banked = form.get("banked") !== null;
  const bankedOn = String(form.get("bankedOn") ?? "").trim() || date;
  if (banked && bankedOn < date) {
    return { ...empty, error: "The banking cannot be dated before the receipt." };
  }
  const banking = banked ? { date: bankedOn } : null;

  // Money into the infrastructure account is for a named project.
  let project: ReceiptProject | undefined;
  if (needsProject) {
    const p = readProject(
      String(form.get("project") ?? ""), String(form.get("projectApproval") ?? ""), String(form.get("projectStatus") ?? ""),
    );
    if ("error" in p) return { ...empty, error: p.error };
    project = p;
  }

  // Infrastructure, boarding and lunch are funded per vote head, not per
  // learner: the bursar enters each head's amount, and nothing is derived.
  if (!capitation) {
    const allocations = heads
      .map((h) => ({ voteHeadCode: h.code, amount: toCents(Number(form.get(`amount_${h.code}`) || 0)) }))
      .filter((a) => a.amount > 0);
    if (!allocations.length) return { ...empty, error: "Enter how much of the receipt goes to each vote head." };
    const distributed = allocations.reduce((a, x) => a + x.amount, 0);
    if (distributed !== amount) {
      return { ...empty, error: "The vote heads must add up to the amount received." };
    }
    return { date, receiptNo, particulars, amount, allocations, rates: {}, banking, project };
  }

  // A flat-funded head takes no rate per learner. The box is shut on the form;
  // this is the same rule on the server, where it cannot be bypassed.
  const rateList = heads
    .filter((h) => !flatOnly.includes(h.code))
    .map((h) => ({ voteHeadCode: h.code, perLearner: toCents(Number(form.get(`rate_${h.code}`) || 0)) }))
    .filter((r) => r.perLearner > 0);
  const flatList = heads
    .map((h) => ({ voteHeadCode: h.code, amount: toCents(Number(form.get(`flat_${h.code}`) || 0)) }))
    .filter((f) => f.amount > 0);
  if (!rateList.length && !flatList.length) {
    return { ...empty, error: "Enter at least one rate per learner, or a flat amount, from the circular." };
  }

  // The rounding residue falls to the largest per-learner vote so the split
  // equals the disbursement to the cent. Not the last head in the chart: a head
  // added later would then quietly start collecting the residue.
  const basic = { voteHeadCode: residualHeadCode(rateList, flatList, heads.map((h) => h.code)) };
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

  return { date, receiptNo, particulars, amount, enrolment, allocations, rates, banking };
}

export async function postReceipt(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  const { user, heads, fy, school, account } = await loadBook(accountId, { write: true, require: "entry.post" });

  const type = account.type as AccountType;
  const capitation = isCapitationAccount(school.level, type);
  const r = readReceiptForm(form, heads, flatOnlyHeadCodes(school.level, type), capitation, takesProject(type));
  if (r.error) return r.error;

  let transactionId: string;
  try {
    const period = await getPeriodForDate(fy.id, r.date);
    await saveVoteHeadRates(fy.id, accountId, r.rates);

    transactionId = await createTransaction({
      periodId: period.id,
      accountId,
      userId: user.id,
      orgId: user.orgId,
      enrolment: r.enrolment,
      rates: r.rates,
      project: r.project,
      txn: {
        date: r.date,
        kind: "receipt",
        particulars: r.particulars || `Receipt ${r.receiptNo}`,
        receiptNo: r.receiptNo || undefined,
        cash: r.amount,
        bank: 0,
        allocations: r.allocations,
      },
      banking: r.banking ?? undefined,
    });
  } catch (e) {
    return e instanceof Error ? e.message : "The receipt could not be posted.";
  }

  revalidatePath(`/app/${accountId}/receipts`);
  // Only a capitation receipt has an acknowledgement to print.
  redirect(capitation
    ? `/app/${accountId}/receipts/${transactionId}/acknowledgement`
    : `/app/${accountId}/receipts`);
}

export async function amendReceipt(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  const transactionId = String(form.get("transactionId") ?? "");
  const { user, heads, school, account } = await loadBook(accountId, { write: true, require: "entry.amend" });

  const type = account.type as AccountType;
  const capitation = isCapitationAccount(school.level, type);
  const r = readReceiptForm(form, heads, flatOnlyHeadCodes(school.level, type), capitation, takesProject(type));
  if (r.error) return r.error;

  try {
    await updateTransaction({
      transactionId,
      accountId,
      userId: user.id,
      orgId: user.orgId,
      enrolment: r.enrolment,
      rates: r.rates,
      project: r.project,
      txn: {
        date: r.date,
        kind: "receipt",
        particulars: r.particulars || `Receipt ${r.receiptNo}`,
        receiptNo: r.receiptNo || undefined,
        cash: r.amount,
        bank: 0,
        allocations: r.allocations,
      },
      banking: r.banking,
    });
  } catch (e) {
    return e instanceof Error ? e.message : "The amendment could not be saved.";
  }

  revalidatePath(`/app/${accountId}`, "layout");
  // Only a capitation receipt has an acknowledgement to print.
  redirect(capitation
    ? `/app/${accountId}/receipts/${transactionId}/acknowledgement`
    : `/app/${accountId}/receipts`);
}

export async function deleteReceipt(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  const transactionId = String(form.get("transactionId") ?? "");
  const { user } = await loadBook(accountId, { write: true, require: "entry.delete" });

  try {
    await deleteTransaction({ transactionId, accountId, userId: user.id, orgId: user.orgId });
  } catch (e) {
    return e instanceof Error ? e.message : "The receipt could not be deleted.";
  }

  revalidatePath(`/app/${accountId}`, "layout");
  redirect(`/app/${accountId}/receipts`);
}

/** Updates an infrastructure project's approval and status, closed month or not. */
export async function updateProjectAction(form: FormData) {
  const accountId = String(form.get("accountId") ?? "");
  const { user } = await loadBook(accountId, { write: true, require: "entry.amend" });
  const p = readProject("-", String(form.get("projectApproval") ?? ""), String(form.get("projectStatus") ?? ""));
  if ("error" in p) return;
  await updateReceiptProject({
    transactionId: String(form.get("transactionId") ?? ""),
    accountId, userId: user.id, orgId: user.orgId,
    approval: p.approval, status: p.status,
  });
  revalidatePath(`/app/${accountId}/receipts`);
}
