import type { Cents } from "./money";

/**
 * What each vote head held on a given date.
 *
 * The payment form used to compare against the year's balance, which counts
 * receipts that had not arrived yet. PITH's laboratory vote is the case that
 * showed it up: 40,000 was paid on 24 October against a vote that had
 * received 5,040, and the rest came in January, March and June. Judged over
 * the year the payment looked funded; on the day it was not.
 *
 * Which is right depends on when the books are written up, and for a bursar
 * posting as the term goes along, the day is the honest answer.
 */
export interface VoteEntry {
  code: string;
  /** ISO yyyy-mm-dd. */
  date: string;
  amount: Cents;
  isPayment: boolean;
}

export function voteBalancesAsAt(
  entries: VoteEntry[],
  asAt: string,
): Record<string, Cents> {
  const balances: Record<string, Cents> = {};
  // A half-typed date must not quietly admit the whole year.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asAt)) {
    for (const e of entries) balances[e.code] = 0;
    return balances;
  }

  for (const e of entries) {
    balances[e.code] ??= 0;
    // On the day itself counts: a receipt banked this morning funds a
    // payment made this afternoon.
    if (e.date > asAt) continue;
    balances[e.code] += e.isPayment ? -e.amount : e.amount;
  }
  return balances;
}
