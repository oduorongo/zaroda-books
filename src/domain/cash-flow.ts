import type { Cents } from "./money";
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
  let cash = opening.cash, bank = opening.bank;
  let receipts = 0, paymentsCash = 0, paymentsBank = 0;

  for (const t of txns) {
    if (t.kind === "contra") {
      if (t.from === "cash") { cash -= t.amount; bank += t.amount; }
      else { bank -= t.amount; cash += t.amount; }
    } else if (t.kind === "receipt") {
      cash += t.cash; bank += t.bank; receipts += t.cash + t.bank;
    } else {
      cash -= t.cash; bank -= t.bank;
      paymentsCash += t.cash; paymentsBank += t.bank;
    }
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
