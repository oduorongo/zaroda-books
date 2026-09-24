import "server-only";
import { db, schema } from "@/db";
import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import type { BookScope, Txn, VoteHead } from "@/domain";
import { scopeAllows } from "@/domain";

export async function getAccountAndSchool(accountId: string) {
  const [row] = await db
    .select({ account: schema.accounts, school: schema.schools })
    .from(schema.accounts)
    .innerJoin(schema.schools, eq(schema.accounts.schoolId, schema.schools.id))
    .where(eq(schema.accounts.id, accountId));
  if (!row) throw new Error("Account not found.");
  return row;
}

/** The one seeded account, for pages that need somewhere to link to. */
export async function getFirstAccount() {
  const [row] = await db
    .select({ account: schema.accounts, school: schema.schools })
    .from(schema.accounts)
    .innerJoin(schema.schools, eq(schema.accounts.schoolId, schema.schools.id))
    .limit(1);
  if (!row) throw new Error("No account seeded yet.");
  return row;
}

/** Every book the org keeps. The tenancy boundary: always scope by org here, never in a route. */
// scope is required, not optional: an omitted scope silently returns every
// school in the org, which is the one mistake this exists to prevent.
export async function getOrgBooks(orgId: string, scope: BookScope) {
  const rows = await db
    .select({ account: schema.accounts, school: schema.schools })
    .from(schema.accounts)
    .innerJoin(schema.schools, eq(schema.accounts.schoolId, schema.schools.id))
    .where(and(eq(schema.schools.orgId, orgId), isNull(schema.accounts.archivedAt)))
    .orderBy(schema.schools.name);

  // Filtered here rather than in SQL: the decision belongs in the domain,
  // where it is tested, not spread across a WHERE clause.
  return scope ? rows.filter((r) => scopeAllows(scope, r.school)) : rows;
}

/**
 * Loads one book, refusing it if it does not belong to the caller's org — and,
 * for an auditor, if the school is outside their area. The check is here and
 * not only in the listing, so a book cannot be reached by guessing its link.
 */
export async function getBookForOrg(accountId: string, orgId: string, scope?: BookScope) {
  const [row] = await db
    .select({ account: schema.accounts, school: schema.schools })
    .from(schema.accounts)
    .innerJoin(schema.schools, eq(schema.accounts.schoolId, schema.schools.id))
    .where(and(
      eq(schema.accounts.id, accountId),
      eq(schema.schools.orgId, orgId),
      isNull(schema.accounts.archivedAt),
    ));
  // An archived book is unreachable even by its own link, not merely unlisted.
  if (!row) throw new Error("Account not found.");
  if (scope && !scopeAllows(scope, row.school)) throw new Error("Account not found.");
  return row;
}

export interface HeadRate {
  perLearner: number;
  flatAmount: number;
}

export async function getVoteHeadRates(
  financialYearId: string,
): Promise<Record<string, HeadRate>> {
  const rows = await db
    .select({
      code: schema.voteHeads.code,
      perLearner: schema.voteHeadRates.perLearner,
      flatAmount: schema.voteHeadRates.flatAmount,
    })
    .from(schema.voteHeadRates)
    .innerJoin(schema.voteHeads, eq(schema.voteHeadRates.voteHeadId, schema.voteHeads.id))
    .where(eq(schema.voteHeadRates.financialYearId, financialYearId));
  return Object.fromEntries(
    rows.map((r) => [r.code, { perLearner: r.perLearner, flatAmount: r.flatAmount }]),
  );
}

/** The rates in force for a financial year, as entered from the circular. */
export async function saveVoteHeadRates(
  financialYearId: string,
  accountId: string,
  ratesByCode: Record<string, HeadRate>,
) {
  const heads = await db
    .select()
    .from(schema.voteHeads)
    .where(eq(schema.voteHeads.accountId, accountId));

  const values = heads
    .filter((h) => ratesByCode[h.code] !== undefined)
    .map((h) => ({
      financialYearId,
      voteHeadId: h.id,
      perLearner: ratesByCode[h.code].perLearner,
      flatAmount: ratesByCode[h.code].flatAmount,
    }));
  if (!values.length) return;

  await db
    .insert(schema.voteHeadRates)
    .values(values)
    .onConflictDoUpdate({
      target: [schema.voteHeadRates.financialYearId, schema.voteHeadRates.voteHeadId],
      set: {
        perLearner: sql`excluded.per_learner`,
        flatAmount: sql`excluded.flat_amount`,
      },
    });
}

export async function getVoteHeads(accountId: string): Promise<VoteHead[]> {
  const heads = await db
    .select()
    .from(schema.voteHeads)
    .where(eq(schema.voteHeads.accountId, accountId))
    .orderBy(schema.voteHeads.order);
  return heads.map((h) => ({ code: h.code, name: h.name, order: h.order }));
}

export async function getFinancialYear(accountId: string) {
  const [fy] = await db
    .select()
    .from(schema.financialYears)
    .where(eq(schema.financialYears.accountId, accountId));
  if (!fy) throw new Error("No financial year seeded for this account.");
  return fy;
}

/** All transactions for a financial year, in the domain engine's Txn shape. */
export async function getTxns(financialYearId: string): Promise<Txn[]> {
  const periods = await db
    .select({ id: schema.periods.id })
    .from(schema.periods)
    .where(eq(schema.periods.financialYearId, financialYearId));
  const periodIds = periods.map((p) => p.id);
  if (periodIds.length === 0) return [];

  const rows = await db
    .select()
    .from(schema.transactions)
    .where(inArray(schema.transactions.periodId, periodIds));

  const allocationRows = await db
    .select({ allocation: schema.allocations, voteHead: schema.voteHeads })
    .from(schema.allocations)
    .innerJoin(schema.voteHeads, eq(schema.allocations.voteHeadId, schema.voteHeads.id))
    .where(inArray(schema.allocations.transactionId, rows.map((r) => r.id)));

  const allocationsByTxn = new Map<string, { voteHeadCode: string; amount: number }[]>();
  for (const { allocation, voteHead } of allocationRows) {
    const list = allocationsByTxn.get(allocation.transactionId) ?? [];
    list.push({ voteHeadCode: voteHead.code, amount: allocation.amount });
    allocationsByTxn.set(allocation.transactionId, list);
  }

  return rows.map((t): Txn => {
    if (t.kind === "contra") {
      return {
        id: t.id,
        date: t.date,
        particulars: t.particulars,
        kind: "contra",
        from: t.contraFrom!,
        to: t.contraTo!,
        // The moved amount is stored in both `cash` and `bank` — see src/db/seed.ts.
        amount: t.cash,
        chequeNo: t.chequeNo ?? undefined,
      };
    }
    const allocations = allocationsByTxn.get(t.id) ?? [];
    if (t.kind === "receipt") {
      return {
        id: t.id, date: t.date, particulars: t.particulars,
        kind: "receipt", receiptNo: t.receiptNo ?? undefined,
        cash: t.cash, bank: t.bank, allocations,
      };
    }
    return {
      id: t.id, date: t.date, particulars: t.particulars,
      kind: "payment", vrNo: t.vrNo ?? undefined, chequeNo: t.chequeNo ?? undefined,
      cash: t.cash, bank: t.bank, allocations,
    };
  });
}

export const inMonth = (txns: Txn[], month: string) => txns.filter((t) => t.date.startsWith(month));
export const upTo = (txns: Txn[], month: string) => txns.filter((t) => t.date <= `${month}-31`);
/** Everything posted before this month — what a month's opening balance is built from. */
export const before = (txns: Txn[], month: string) => txns.filter((t) => t.date < `${month}-01`);

/** Last year's closing cash and bank, carried into this book. Not a transaction. */
export async function saveOpeningBalances(
  financialYearId: string,
  openingCash: number,
  openingBank: number,
) {
  await db
    .update(schema.financialYears)
    .set({ openingCash, openingBank })
    .where(eq(schema.financialYears.id, financialYearId));
}

/** One posted receipt with the circular figures it was worked from, for amending. */
export async function getReceiptForEdit(transactionId: string, accountId: string) {
  const [txn] = await db
    .select()
    .from(schema.transactions)
    .where(eq(schema.transactions.id, transactionId));
  if (!txn || txn.kind !== "receipt") return null;

  const lines = await db
    .select({
      code: schema.voteHeads.code,
      perLearner: schema.allocations.perLearner,
      flatAmount: schema.allocations.flatAmount,
    })
    .from(schema.allocations)
    .innerJoin(schema.voteHeads, eq(schema.allocations.voteHeadId, schema.voteHeads.id))
    .where(
      and(
        eq(schema.allocations.transactionId, transactionId),
        eq(schema.voteHeads.accountId, accountId),
      ),
    );

  const [banking] = await db
    .select({ date: schema.transactions.date })
    .from(schema.transactions)
    .where(eq(schema.transactions.bankedFrom, transactionId));

  return {
    id: txn.id,
    date: txn.date,
    receiptNo: txn.receiptNo ?? "",
    particulars: txn.particulars,
    amount: txn.cash + txn.bank,
    bankedOn: banking?.date ?? null,
    rates: Object.fromEntries(
      lines.map((l) => [l.code, {
        perLearner: l.perLearner ?? 0,
        flatAmount: l.flatAmount ?? 0,
      }]),
    ) as Record<string, HeadRate>,
  };
}

/** One posted payment in the shape the payment form amends. */
export async function getPaymentForEdit(transactionId: string, accountId: string) {
  const [txn] = await db
    .select()
    .from(schema.transactions)
    .where(eq(schema.transactions.id, transactionId));
  if (!txn || txn.kind !== "payment") return null;

  const lines = await db
    .select({ code: schema.voteHeads.code, amount: schema.allocations.amount })
    .from(schema.allocations)
    .innerJoin(schema.voteHeads, eq(schema.allocations.voteHeadId, schema.voteHeads.id))
    .where(
      and(
        eq(schema.allocations.transactionId, transactionId),
        eq(schema.voteHeads.accountId, accountId),
      ),
    );

  return {
    id: txn.id,
    date: txn.date,
    vrNo: txn.vrNo ?? "",
    chequeNo: txn.chequeNo ?? "",
    particulars: txn.particulars,
    method: txn.cash > 0 ? "cash" : "bank",
    amounts: Object.fromEntries(lines.map((l) => [l.code, l.amount])),
  };
}

/**
 * One posted transfer between cash and bank, for amending. Only from this
 * book's year: the route supplies the id, and nothing else ties the two.
 */
export async function getTransferForEdit(transactionId: string, financialYearId: string) {
  const [row] = await db
    .select({ txn: schema.transactions })
    .from(schema.transactions)
    .innerJoin(schema.periods, eq(schema.transactions.periodId, schema.periods.id))
    .where(
      and(
        eq(schema.transactions.id, transactionId),
        eq(schema.periods.financialYearId, financialYearId),
      ),
    );
  const txn = row?.txn;
  if (!txn || txn.kind !== "contra") return null;

  return {
    id: txn.id,
    date: txn.date,
    particulars: txn.particulars,
    chequeNo: txn.chequeNo ?? "",
    from: txn.contraFrom!,
    amount: txn.cash,
    bankedFrom: txn.bankedFrom,
  };
}

/**
 * The transfers a receipt made itself when it was posted as banked, keyed by
 * the transfer. They follow their receipt, so they are amended through it.
 */
export async function getReceiptBankings(financialYearId: string) {
  const periods = await db
    .select({ id: schema.periods.id })
    .from(schema.periods)
    .where(eq(schema.periods.financialYearId, financialYearId));
  if (periods.length === 0) return new Map<string, { receiptId: string; receiptNo: string }>();

  const contras = await db
    .select({ id: schema.transactions.id, receiptId: schema.transactions.bankedFrom })
    .from(schema.transactions)
    .where(
      and(
        inArray(schema.transactions.periodId, periods.map((p) => p.id)),
        isNotNull(schema.transactions.bankedFrom),
      ),
    );
  const receipts = contras.length
    ? await db
      .select({ id: schema.transactions.id, receiptNo: schema.transactions.receiptNo })
      .from(schema.transactions)
      .where(inArray(schema.transactions.id, contras.map((c) => c.receiptId!)))
    : [];
  const receiptNo = new Map(receipts.map((r) => [r.id, r.receiptNo ?? ""]));

  return new Map(contras.map((c) => [c.id, {
    receiptId: c.receiptId!,
    receiptNo: receiptNo.get(c.receiptId!) ?? "",
  }]));
}

/** The enrolment frozen on a capitation receipt when it was posted. */
export async function getReceiptEnrolment(transactionId: string): Promise<number | null> {
  const [row] = await db
    .select({ enrolment: schema.transactions.enrolment })
    .from(schema.transactions)
    .where(eq(schema.transactions.id, transactionId));
  return row?.enrolment ?? null;
}

/**
 * The enrolment in force: the figure frozen on the most recent capitation
 * receipt of the year. Rule 7 — it is derived once, per disbursement, and the
 * latest disbursement is the one the school is working to.
 */
export async function getEnrolmentInForce(financialYearId: string) {
  const periods = await db
    .select({ id: schema.periods.id })
    .from(schema.periods)
    .where(eq(schema.periods.financialYearId, financialYearId));
  if (!periods.length) return null;

  const [row] = await db
    .select({
      enrolment: schema.transactions.enrolment,
      date: schema.transactions.date,
      receiptNo: schema.transactions.receiptNo,
    })
    .from(schema.transactions)
    .where(
      and(
        inArray(schema.transactions.periodId, periods.map((p) => p.id)),
        eq(schema.transactions.kind, "receipt"),
        isNotNull(schema.transactions.enrolment),
      ),
    )
    .orderBy(desc(schema.transactions.date))
    .limit(1);

  return row?.enrolment ? { learners: row.enrolment, date: row.date, receiptNo: row.receiptNo } : null;
}
