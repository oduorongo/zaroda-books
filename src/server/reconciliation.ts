import "server-only";
import { db, schema } from "@/db";
import { and, eq, inArray, lte } from "drizzle-orm";
import { balancesAfter, buildReconciliation, type Reconciliation } from "@/domain";
import { loadBook } from "@/server/book-context";
import { getTxns, upTo } from "@/server/queries";
import { getReportPeriod, monthKey } from "@/server/periods";

/**
 * The reconciliation for one month. Everything banked up to the end of the
 * month is a candidate: a cheque written in June and still unpresented in
 * August is exactly what the statement is meant to surface, so outstanding
 * items are never dropped when the month rolls over.
 */
export async function getReconciliation(accountId: string, asked?: string) {
  const { fy, school, account } = await loadBook(accountId);
  const txns = await getTxns(fy.id);
  const { period, periods } = await getReportPeriod(fy.id, txns, asked);
  const month = monthKey(period.month);

  const toDate = upTo(txns, month);
  const perCashBook = balancesAfter(
    { cash: fy.openingCash, bank: fy.openingBank },
    toDate,
  ).bank;

  const clearedRows = await db
    .select({ id: schema.transactions.id })
    .from(schema.transactions)
    .where(
      and(
        inArray(schema.transactions.id, toDate.map((t) => t.id)),
        lte(schema.transactions.clearedOn, `${month}-31`),
      ),
    );

  const reconciliation: Reconciliation = buildReconciliation({
    perCashBook,
    txns: toDate,
    cleared: new Set(clearedRows.map((r) => r.id)),
    statementBalance: period.statementBank ?? 0,
  });

  return {
    reconciliation,
    period,
    periods,
    month,
    school,
    account,
    fy,
    hasStatement: period.statementBank !== null,
    posted: new Set(txns.map((t) => t.date.slice(0, 7))),
  };
}

/** The closing balance the bank states for the month, straight off the statement. */
export async function saveStatementBalance(
  periodId: string,
  accountId: string,
  statementBank: number,
  statementDate: string | null,
) {
  await assertPeriodInAccount(periodId, accountId);
  await db
    .update(schema.periods)
    .set({ statementBank, statementDate })
    .where(eq(schema.periods.id, periodId));
}

/**
 * Ticks an entry off against the statement, or unticks it. The date is the one
 * the bank shows, which is not always the date in the book — that gap is the
 * whole point of a reconciliation.
 */
export async function setCleared(
  transactionId: string,
  accountId: string,
  clearedOn: string | null,
) {
  const [txn] = await db
    .select({ periodId: schema.transactions.periodId })
    .from(schema.transactions)
    .where(eq(schema.transactions.id, transactionId));
  if (!txn) throw new Error("Entry not found.");
  await assertPeriodInAccount(txn.periodId, accountId);

  await db
    .update(schema.transactions)
    .set({ clearedOn })
    .where(eq(schema.transactions.id, transactionId));
}

async function assertPeriodInAccount(periodId: string, accountId: string) {
  const [row] = await db
    .select({ accountId: schema.financialYears.accountId })
    .from(schema.periods)
    .innerJoin(
      schema.financialYears,
      eq(schema.periods.financialYearId, schema.financialYears.id),
    )
    .where(eq(schema.periods.id, periodId));
  if (!row || row.accountId !== accountId) throw new Error("Month not found.");
}

