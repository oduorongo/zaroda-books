import type { Cents } from "./money";
import type { Balances, Txn } from "./types";

/**
 * What cash and bank are worth once these transactions have run. The single
 * statement of that rule: a receipt adds to each side, a payment subtracts,
 * and a contra moves between them without changing the total.
 */
export function balancesAfter(opening: Balances, txns: Txn[]): Balances {
  let { cash, bank } = opening;
  for (const t of txns) {
    if (t.kind === "contra") {
      if (t.from === "cash") { cash -= t.amount; bank += t.amount; }
      else { bank -= t.amount; cash += t.amount; }
    } else if (t.kind === "receipt") {
      cash += t.cash; bank += t.bank;
    } else {
      cash -= t.cash; bank -= t.bank;
    }
  }
  return { cash, bank };
}

/**
 * Cash on hand as at a date, the same "on the day counts, later doesn't" rule
 * as `voteBalancesAsAt` — a payment is judged against what the cash box held
 * that day, not the year's total. `excludingId` leaves out a transaction's
 * own prior version when amending it.
 */
export function cashAvailableAsAt(
  openingCash: Cents,
  txns: Txn[],
  asAt: string,
  excludingId?: string,
): Cents {
  const upTo = txns.filter((t) => t.date <= asAt && t.id !== excludingId);
  return balancesAfter({ cash: openingCash, bank: 0 }, upTo).cash;
}
