import type { Cents } from "./money";
import type { SchoolLevel } from "./vote-heads";

/** The published price of one financial year at one level. CLAUDE.md rule 6. */
export const LEVEL_PRICE: Record<SchoolLevel, Cents> = {
  primary: 48_000,
  junior: 58_000,
  senior: 106_000,
};

export interface RevenueTotals {
  collected: Cents;
  outstanding: Cents;
  paidCount: number;
  unpaidCount: number;
}

/**
 * What a set of subscriptions is worth. A subscription with no paidAt is a book
 * opened against a payment that has not arrived, so it is outstanding, not
 * collected — the two are never added together.
 */
export function revenue(
  subs: { level: SchoolLevel; paidAt: Date | null }[],
): RevenueTotals {
  const totals: RevenueTotals = { collected: 0, outstanding: 0, paidCount: 0, unpaidCount: 0 };
  for (const s of subs) {
    const price = LEVEL_PRICE[s.level];
    if (s.paidAt) {
      totals.collected += price;
      totals.paidCount += 1;
    } else {
      totals.outstanding += price;
      totals.unpaidCount += 1;
    }
  }
  return totals;
}
