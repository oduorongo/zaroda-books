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
