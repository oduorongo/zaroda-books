import "server-only";
import { randomUUID } from "node:crypto";
import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";
import { bankingContraFor, cashAvailableAsAt, validateTransaction } from "@/domain";
import type { NewTxn, Txn } from "@/domain";
import { getTxns } from "./queries";

/** Cash a transaction takes out of the box: a payment's cash leg, or a contra drawing cash to bank. */
function cashOut(t: NewTxn | Txn): bigint | number {
  if (t.kind === "payment") return t.cash;
  if (t.kind === "contra" && t.from === "cash") return t.amount;
  return 0;
}

async function assertCashAvailable(
  financialYearId: string,
  openingCash: number,
  t: NewTxn,
  excludingId?: string,
) {
  const out = cashOut(t);
  if (!out || Number(out) <= 0) return;
  const txns = await getTxns(financialYearId);
  const available = cashAvailableAsAt(openingCash, txns, t.date, excludingId);
  if (Number(out) > available) {
    throw new Error(
      "Not enough cash in hand for this amount as at this date. Draw cash from the bank first.",
    );
  }
}

/**
 * Amending or removing a transfer changes the cash in hand from its date on,
 * so every later day is checked, not just its own: drawing less cash from the
 * bank must not strand a cash payment already made on the strength of it. A
 * day already short before the change is left to its own entries.
 */
async function assertCashStaysCovered(
  financialYearId: string,
  openingCash: number,
  id: string,
  replacement?: Txn,
) {
  const txns = await getTxns(financialYearId);
  const after = [...txns.filter((t) => t.id !== id), ...(replacement ? [replacement] : [])];
  const dates = [...new Set(after.map((t) => t.date))].sort();
  for (const date of dates) {
    const now = cashAvailableAsAt(openingCash, after, date);
    if (now < 0 && now < cashAvailableAsAt(openingCash, txns, date)) {
      throw new Error(
        `This would leave the cash box short on ${date}, where cash has already been paid out. ` +
        "Amend or remove those cash payments first.",
      );
    }
  }
}

/** The circular figures behind each allocation line, by vote head code. */
export type LineRates = Record<string, { perLearner: number; flatAmount: number }>;

/**
 * The only way a transaction enters the system. Validation happens here, in the
 * same call as the insert, so no route can bypass it.
 */
export async function createTransaction(input: {
  periodId: string;
  accountId: string;
  userId: string;
  orgId: string;
  txn: NewTxn;
  enrolment?: number;
  rates?: LineRates;
  /** Bank this receipt the same call: the contra lands in the same batch. */
  banking?: { date: string };
}) {
  const period = await db.query.periods.findFirst({
    where: eq(schema.periods.id, input.periodId),
  });
  if (!period) throw new Error("Period not found.");
  if (period.status === "closed") throw new Error("This month is closed. Reopen it to post.");

  const heads = await db.query.voteHeads.findMany({
    where: eq(schema.voteHeads.accountId, input.accountId),
  });

  const id = randomUUID();
  const candidate = { ...input.txn, id } as Txn;
  const errors = validateTransaction(candidate, heads.map((h) => h.code));
  if (errors.length) throw new Error(errors.join(" "));

  const fy = await db.query.financialYears.findFirst({
    where: eq(schema.financialYears.id, period.financialYearId),
  });
  if (!fy) throw new Error("Financial year not found.");
  await assertCashAvailable(fy.id, fy.openingCash, input.txn);

  const t = input.txn;
  const row = {
    id,
    periodId: input.periodId,
    date: t.date,
    kind: t.kind,
    particulars: t.particulars,
    receiptNo: t.kind === "receipt" ? t.receiptNo : undefined,
    vrNo: t.kind === "payment" ? t.vrNo : undefined,
    narration: t.kind === "payment" ? t.narration : undefined,
    chequeNo: t.kind !== "receipt" ? t.chequeNo : undefined,
    // A contra has no cash/bank pair of its own — the moved amount is stored in
    // both columns, alongside contraFrom/contraTo. See src/db/seed.ts.
    cash: t.kind === "contra" ? t.amount : t.cash,
    bank: t.kind === "contra" ? t.amount : t.bank,
    enrolment: t.kind === "receipt" ? input.enrolment : undefined,
    contraFrom: t.kind === "contra" ? t.from : undefined,
    contraTo: t.kind === "contra" ? t.to : undefined,
    createdBy: input.userId,
  };

  const idByCode = new Map(heads.map((h) => [h.code, h.id]));
  const allocationRows = t.kind === "contra" ? [] : t.allocations.map((a) => {
    const voteHeadId = idByCode.get(a.voteHeadCode);
    if (!voteHeadId) throw new Error(`Unknown vote head code ${a.voteHeadCode}`);
    return {
      transactionId: id,
      voteHeadId,
      amount: a.amount,
      perLearner: input.rates?.[a.voteHeadCode]?.perLearner,
      flatAmount: input.rates?.[a.voteHeadCode]?.flatAmount,
    };
  });

  const audit = {
    orgId: input.orgId,
    userId: input.userId,
    action: "create",
    entity: "transaction",
    entityId: id,
    after: JSON.stringify(candidate),
  };

  const banking = input.banking && t.kind === "receipt"
    ? await bankingRow(t, input.banking.date, id, period.financialYearId, input.userId)
    : null;

  // The Neon HTTP driver has no interactive transactions; `batch` is Neon's
  // atomic multi-statement call, so the transaction, its allocations, its
  // banking and the audit row still land together or not at all.
  const writes = [
    db.insert(schema.transactions).values(row),
    ...(allocationRows.length ? [db.insert(schema.allocations).values(allocationRows)] : []),
    ...(banking ? [db.insert(schema.transactions).values(banking)] : []),
    db.insert(schema.auditLog).values(audit),
  ] as const;
  await db.batch(writes as unknown as Parameters<typeof db.batch>[0]);

  return id;
}

/**
 * The banking leg of a receipt. It carries `bankedFrom`, so the pair stays
 * together through an amendment and goes together on a delete.
 */
async function bankingRow(
  receipt: Extract<NewTxn, { kind: "receipt" }>,
  date: string,
  receiptId: string,
  financialYearId: string,
  userId: string,
) {
  const contra = bankingContraFor(receipt, date);
  const period = await db.query.periods.findFirst({
    where: and(
      eq(schema.periods.financialYearId, financialYearId),
      eq(schema.periods.month, `${date.slice(0, 7)}-01`),
    ),
  });
  if (!period) throw new Error("The banking date falls outside this financial year.");
  if (period.status === "closed")
    throw new Error("The month you are banking into is closed. Reopen it, or bank on another date.");

  return {
    id: randomUUID(),
    periodId: period.id,
    date: contra.date,
    kind: "contra" as const,
    particulars: contra.particulars,
    cash: contra.amount,
    bank: contra.amount,
    contraFrom: contra.from,
    contraTo: contra.to,
    bankedFrom: receiptId,
    createdBy: userId,
  };
}

/**
 * The only way a posted transaction changes. Same validation as the insert, and
 * the allocation lines are replaced wholesale rather than patched, so the
 * amended entry is checked as a whole. Both months must be open: the one the
 * entry sits in, and the one an amended date moves it to.
 */
export async function updateTransaction(input: {
  transactionId: string;
  accountId: string;
  userId: string;
  orgId: string;
  txn: NewTxn;
  enrolment?: number;
  rates?: LineRates;
  /** A date rebanks the amended receipt; null leaves the money in the cash box. */
  banking?: { date: string } | null;
}) {
  const existing = await db.query.transactions.findFirst({
    where: eq(schema.transactions.id, input.transactionId),
  });
  if (!existing) throw new Error("Transaction not found.");

  const from = await db.query.periods.findFirst({
    where: eq(schema.periods.id, existing.periodId),
  });
  if (!from) throw new Error("Period not found.");
  if (from.status === "closed") throw new Error("This month is closed. Reopen it to amend.");
  await assertInAccount(from.financialYearId, input.accountId);

  const periods = await db.query.periods.findMany({
    where: eq(schema.periods.financialYearId, from.financialYearId),
  });

  const to = periods.find((p) => p.month.slice(0, 7) === input.txn.date.slice(0, 7));
  if (!to) throw new Error("That date falls outside this financial year.");
  if (to.status === "closed") throw new Error("The month you are moving this entry to is closed.");

  const heads = await db.query.voteHeads.findMany({
    where: eq(schema.voteHeads.accountId, input.accountId),
  });

  const id = input.transactionId;
  const candidate = { ...input.txn, id } as Txn;
  const errors = validateTransaction(candidate, heads.map((h) => h.code));
  if (errors.length) throw new Error(errors.join(" "));

  const fy = await db.query.financialYears.findFirst({
    where: eq(schema.financialYears.id, from.financialYearId),
  });
  if (!fy) throw new Error("Financial year not found.");
  await assertCashAvailable(fy.id, fy.openingCash, input.txn, id);
  if (existing.kind === "contra") await assertCashStaysCovered(fy.id, fy.openingCash, id, candidate);

  const t = input.txn;
  const row = {
    periodId: to.id,
    date: t.date,
    kind: t.kind,
    particulars: t.particulars,
    receiptNo: t.kind === "receipt" ? t.receiptNo ?? null : null,
    vrNo: t.kind === "payment" ? t.vrNo ?? null : null,
    narration: t.kind === "payment" ? t.narration ?? null : null,
    chequeNo: t.kind !== "receipt" ? t.chequeNo ?? null : null,
    cash: t.kind === "contra" ? t.amount : t.cash,
    bank: t.kind === "contra" ? t.amount : t.bank,
    // Re-derived from the amended disbursement and the amended rates, then
    // frozen again. Rule 7 forbids recomputing when rates later change; this is
    // the entry itself being corrected.
    enrolment: t.kind === "receipt" ? input.enrolment ?? null : null,
    contraFrom: t.kind === "contra" ? t.from : null,
    contraTo: t.kind === "contra" ? t.to : null,
  };

  const idByCode = new Map(heads.map((h) => [h.code, h.id]));
  const allocationRows = t.kind === "contra" ? [] : t.allocations.map((a) => {
    const voteHeadId = idByCode.get(a.voteHeadCode);
    if (!voteHeadId) throw new Error(`Unknown vote head code ${a.voteHeadCode}`);
    return {
      transactionId: id,
      voteHeadId,
      amount: a.amount,
      perLearner: input.rates?.[a.voteHeadCode]?.perLearner,
      flatAmount: input.rates?.[a.voteHeadCode]?.flatAmount,
    };
  });

  const audit = {
    orgId: input.orgId,
    userId: input.userId,
    action: "update",
    entity: "transaction",
    entityId: id,
    before: JSON.stringify(existing),
    after: JSON.stringify(candidate),
  };

  // The banking follows the receipt: rewritten when the amount or the banking
  // date moves, dropped when the money is no longer banked.
  const banked = await db.query.transactions.findFirst({
    where: eq(schema.transactions.bankedFrom, id),
  });
  const wants = t.kind === "receipt" ? input.banking ?? null : null;
  const fresh = wants
    ? await bankingRow(t as Extract<NewTxn, { kind: "receipt" }>, wants.date, id, from.financialYearId, input.userId)
    : null;

  const bankingWrites = [
    ...(banked && (!fresh || banked.date !== fresh.date)
      ? [db.delete(schema.transactions).where(eq(schema.transactions.id, banked.id))]
      : []),
    ...(fresh && banked && banked.date === fresh.date
      ? [db.update(schema.transactions)
          .set({ cash: fresh.cash, bank: fresh.bank, particulars: fresh.particulars })
          .where(eq(schema.transactions.id, banked.id))]
      : fresh ? [db.insert(schema.transactions).values(fresh)] : []),
  ];

  const writes = [
    db.update(schema.transactions).set(row).where(eq(schema.transactions.id, id)),
    db.delete(schema.allocations).where(eq(schema.allocations.transactionId, id)),
    ...(allocationRows.length ? [db.insert(schema.allocations).values(allocationRows)] : []),
    ...bankingWrites,
    db.insert(schema.auditLog).values(audit),
  ] as const;
  await db.batch(writes as unknown as Parameters<typeof db.batch>[0]);

  return id;
}

/**
 * Removes a posted entry outright. The books normally reverse rather than
 * delete; this is for an entry posted in error. The audit row carries the whole
 * entry and its lines, so what was removed can still be answered for.
 */
export async function deleteTransaction(input: {
  transactionId: string;
  accountId: string;
  userId: string;
  orgId: string;
}) {
  const existing = await db.query.transactions.findFirst({
    where: eq(schema.transactions.id, input.transactionId),
  });
  if (!existing) throw new Error("Transaction not found.");

  const period = await db.query.periods.findFirst({
    where: eq(schema.periods.id, existing.periodId),
  });
  if (!period) throw new Error("Period not found.");
  if (period.status === "closed") throw new Error("This month is closed. Reopen it to delete.");
  await assertInAccount(period.financialYearId, input.accountId);

  if (existing.kind === "contra") {
    const fy = await db.query.financialYears.findFirst({
      where: eq(schema.financialYears.id, period.financialYearId),
    });
    await assertCashStaysCovered(period.financialYearId, fy!.openingCash, input.transactionId);
  }

  const lines = await db
    .select({ code: schema.voteHeads.code, amount: schema.allocations.amount })
    .from(schema.allocations)
    .innerJoin(schema.voteHeads, eq(schema.allocations.voteHeadId, schema.voteHeads.id))
    .where(
      and(
        eq(schema.allocations.transactionId, input.transactionId),
        eq(schema.voteHeads.accountId, input.accountId),
      ),
    );

  const audit = {
    orgId: input.orgId,
    userId: input.userId,
    action: "delete",
    entity: "transaction",
    entityId: input.transactionId,
    before: JSON.stringify({ ...existing, allocations: lines }),
  };

  const writes = [
    db.insert(schema.auditLog).values(audit),
    // The allocation rows go with it: they cascade on the foreign key.
    db.delete(schema.transactions).where(eq(schema.transactions.id, input.transactionId)),
  ] as const;
  await db.batch(writes as unknown as Parameters<typeof db.batch>[0]);
}

/**
 * An entry may only be amended or removed through the book it belongs to: the
 * route supplies the transaction id, and nothing else ties the two together.
 */
async function assertInAccount(financialYearId: string, accountId: string) {
  const fy = await db.query.financialYears.findFirst({
    where: eq(schema.financialYears.id, financialYearId),
  });
  if (!fy || fy.accountId !== accountId) throw new Error("Transaction not found.");
}
