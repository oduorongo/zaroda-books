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
  /** Granted, not sold: the tenant's one free school. */
  freeCount: number;
}

/**
 * What a set of subscriptions is worth. A subscription with no paidAt is a book
 * opened against a payment that has not arrived, so it is outstanding, not
 * collected — the two are never added together.
 */
export function revenue(
  subs: { level: SchoolLevel; paidAt: Date | null; isFree?: boolean }[],
): RevenueTotals {
  const totals: RevenueTotals = {
    collected: 0, outstanding: 0, paidCount: 0, unpaidCount: 0, freeCount: 0,
  };
  for (const s of subs) {
    const price = LEVEL_PRICE[s.level];
    // Paid wins over free: a free book absorbed by a later payment is money
    // that arrived, and counting it as a gift would hide it.
    if (s.paidAt) {
      totals.collected += price;
      totals.paidCount += 1;
    } else if (s.isFree) {
      totals.freeCount += 1;
    } else {
      totals.outstanding += price;
      totals.unpaidCount += 1;
    }
  }
  return totals;
}

/**
 * The price as the marketing page shows it: whole shillings, thousands grouped,
 * no decimals. Derived from LEVEL_PRICE so the page and the invoice cannot
 * disagree — raising a price is one edit, above, and nowhere else.
 */
export const priceLabel = (level: SchoolLevel): string =>
  Math.round(LEVEL_PRICE[level] / 100).toLocaleString("en-KE");

/**
 * What to actually charge. Tuma's sandbox refuses anything from KES 100 up, so
 * a real subscription price cannot be pushed through it at all — TUMA_TEST_AMOUNT_KES
 * substitutes a token amount for testing the round trip.
 *
 * The amount returned is what gets charged AND what gets recorded. Storing the
 * list price against a shilling taken would put money in the books that never
 * arrived, which is the one thing the books must never say.
 */
export function chargeAmount(
  priceCents: Cents,
  overrideKes: string | undefined,
): { cents: Cents; isTest: boolean } {
  const n = Number(overrideKes);
  if (!overrideKes?.trim() || !Number.isFinite(n) || n <= 0) {
    return { cents: priceCents, isTest: false };
  }
  return { cents: Math.round(n * 100), isTest: true };
}

/**
 * Zaroda's own reference for a subscription receipt, e.g. ZB/2025-26/0042.
 *
 * Separate from the M-Pesa receipt number, which is Safaricom's and proves the
 * money moved. This one is ours and gives the tenant something to quote. The
 * year is written with a dash so the whole reference reads as one token.
 */
export function subscriptionReceiptNo(fyLabel: string, issuedBefore: number): string {
  return `ZB/${fyLabel.replace("/", "-")}/${String(issuedBefore + 1).padStart(4, "0")}`;
}
