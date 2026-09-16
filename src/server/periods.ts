import "server-only";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { buildTrialBalance } from "@/domain";
import type { Balances, Txn, VoteHead } from "@/domain";

/**
 * The month the books are open at: today's, if it falls inside the year,
 * otherwise the last month of the year. Reports default to this.
 */
export async function getCurrentPeriod(financialYearId: string) {
  const periods = await db
    .select()
    .from(schema.periods)
    .where(eq(schema.periods.financialYearId, financialYearId))
    .orderBy(schema.periods.month);
  if (!periods.length) throw new Error("No periods opened for this financial year.");

  const thisMonth = `${new Date().toISOString().slice(0, 7)}-01`;
  return periods.find((p) => p.month === thisMonth) ?? periods[periods.length - 1];
}

/** "2026-05-01" -> "2026-05", the prefix the report filters match on. */
export const monthKey = (month: string) => month.slice(0, 7);

export const monthName = (month: string) =>
  new Date(`${month}T00:00:00Z`).toLocaleDateString("en-KE", {
    month: "long", year: "numeric", timeZone: "UTC",
  });

/**
 * Invariant 4 and 5. Closing computes bal c/d, writes it as the next month's
 * bal b/d, and freezes the month. It refuses to run on an unbalanced book.
 */
export function assertClosable(
  asAt: string,
  yearOpening: Balances,
  txnsToDate: Txn[],
  heads: VoteHead[],
) {
  const tb = buildTrialBalance(asAt, yearOpening, txnsToDate, heads);
  if (!tb.balanced)
    throw new Error(
      `Trial balance is out by ${tb.difference / 100}. Find the entry before closing.`,
    );
  if (tb.closingCash < 0) throw new Error("Cash in hand cannot be negative.");
  return tb;
}
