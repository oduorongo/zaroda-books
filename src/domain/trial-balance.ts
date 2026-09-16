import type { Cents } from "./money";
import { balancesAfter } from "./balances";
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
  const { cash, bank } = balancesAfter(yearOpening, txnsToDate);

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
