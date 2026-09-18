import "server-only";
import { db, schema } from "@/db";
import { and, eq } from "drizzle-orm";
import { buildTrialBalance } from "@/domain";
import type { Balances, Reconciliation, Txn, VoteHead } from "@/domain";

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
  reconciliation?: Reconciliation | null,
) {
  const tb = buildTrialBalance(asAt, yearOpening, txnsToDate, heads);
  if (!tb.balanced)
    throw new Error(
      `Trial balance is out by ${tb.difference / 100}. Find the entry before closing.`,
    );
  if (tb.closingCash < 0) throw new Error("Cash in hand cannot be negative.");

  // The bank column is only proven by the statement. A month that has not been
  // reconciled has not been checked against anything outside the book.
  if (!reconciliation)
    throw new Error(
      "Enter the closing balance from the bank statement and reconcile the month before closing.",
    );
  if (!reconciliation.reconciled)
    throw new Error(
      `The bank reconciliation is out by ${reconciliation.difference / 100}. `
      + "Post what the statement shows and the book does not before closing.",
    );

  return tb;
}

/** The month an entry belongs in: the one its own date falls in, not today's. */
export async function getPeriodForDate(financialYearId: string, date: string) {
  const period = await db.query.periods.findFirst({
    where: and(
      eq(schema.periods.financialYearId, financialYearId),
      eq(schema.periods.month, `${date.slice(0, 7)}-01`),
    ),
  });
  if (!period) throw new Error("That date falls outside this financial year.");
  if (period.status === "closed") throw new Error("That month is closed. Reopen it to post.");
  return period;
}

/**
 * The month a report opens on. A book whose year has ended would otherwise open
 * on its last month, which is usually empty — so fall back to the last month
 * that actually holds entries.
 */
export async function getReportPeriod(
  financialYearId: string,
  txns: Txn[],
  requested?: string,
) {
  const periods = await db
    .select()
    .from(schema.periods)
    .where(eq(schema.periods.financialYearId, financialYearId))
    .orderBy(schema.periods.month);
  if (!periods.length) throw new Error("No periods opened for this financial year.");

  const asked = requested && periods.find((p) => monthKey(p.month) === requested);
  if (asked) return { period: asked, periods };

  const thisMonth = `${new Date().toISOString().slice(0, 7)}-01`;
  const current = periods.find((p) => p.month === thisMonth);
  if (current) return { period: current, periods };

  const posted = [...periods].reverse().find((p) => txns.some((t) => t.date.startsWith(monthKey(p.month))));
  return { period: posted ?? periods[periods.length - 1], periods };
}
