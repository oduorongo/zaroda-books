import type { Cents } from "./money";
import { balancesAfter } from "./balances";
import type { Balances, Txn } from "./types";

export interface CashFlow {
  asAt: string;
  openingCash: Cents;
  openingBank: Cents;
  openingTotal: Cents;
  receipts: Cents;
  paymentsCash: Cents;
  paymentsBank: Cents;
  closingCash: Cents;
  closingBank: Cents;
  closingTotal: Cents;
}

/** Derived, like every other book. A contra moves money between cash and bank and nets to nil. */
export function buildCashFlow(asAt: string, opening: Balances, txns: Txn[]): CashFlow {
  const { cash, bank } = balancesAfter(opening, txns);

  let receipts = 0, paymentsCash = 0, paymentsBank = 0;
  for (const t of txns) {
    if (t.kind === "receipt") receipts += t.cash + t.bank;
    else if (t.kind === "payment") { paymentsCash += t.cash; paymentsBank += t.bank; }
  }

  return {
    asAt,
    openingCash: opening.cash,
    openingBank: opening.bank,
    openingTotal: opening.cash + opening.bank,
    receipts,
    paymentsCash,
    paymentsBank,
    closingCash: cash,
    closingBank: bank,
    closingTotal: cash + bank,
  };
}
