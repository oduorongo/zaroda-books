import type { Cents } from "./money";
import { buildLedger } from "./ledger";
import type { Balances, Txn, VoteHead } from "./types";

export interface TrialBalance {
  asAt: string;
  openingCash: Cents;
  openingBank: Cents;
  lines: { code: string; name: string; dr: Cents; cr: Cents }[];
  closingCash: Cents;
  closingBank: Cents;
  totalDr: Cents;
  totalCr: Cents;
  balanced: boolean;
  difference: Cents;
}

/**
 * Year-to-date trial balance, matching the workbooks: opening cash and bank sit
 * on the credit side, closing cash and bank on the debit side.
 * Invariant 4 — a period cannot close unless `balanced` is true.
 */
export function buildTrialBalance(
  asAt: string,
  yearOpening: Balances,
  txnsToDate: Txn[],
  heads: VoteHead[],
): TrialBalance {
  const ledger = buildLedger(txnsToDate, heads);

  let cash = yearOpening.cash, bank = yearOpening.bank;
  for (const t of txnsToDate) {
    if (t.kind === "contra") {
      if (t.from === "cash") { cash -= t.amount; bank += t.amount; }
      else { bank -= t.amount; cash += t.amount; }
    } else if (t.kind === "receipt") { cash += t.cash; bank += t.bank; }
    else { cash -= t.cash; bank -= t.bank; }
  }

  const lines = ledger.map(({ code, name, dr, cr }) => ({ code, name, dr, cr }));
  const totalDr = lines.reduce((a, l) => a + l.dr, 0) + cash + bank;
  const totalCr = lines.reduce((a, l) => a + l.cr, 0) + yearOpening.cash + yearOpening.bank;

  return {
    asAt,
    openingCash: yearOpening.cash,
    openingBank: yearOpening.bank,
    lines,
    closingCash: cash,
    closingBank: bank,
    totalDr,
    totalCr,
    balanced: totalDr === totalCr,
    difference: totalDr - totalCr,
  };
}
