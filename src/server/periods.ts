import "server-only";
import { buildTrialBalance } from "@/domain";
import type { Balances, Txn, VoteHead } from "@/domain";

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
