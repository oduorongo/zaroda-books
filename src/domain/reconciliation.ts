import type { Cents } from "./money";
import type { Txn } from "./types";

/** What an entry does to the bank column. Positive puts money in. */
export function bankEffect(t: Txn): Cents {
  if (t.kind === "contra") return t.to === "bank" ? t.amount : -t.amount;
  return t.kind === "receipt" ? t.bank : -t.bank;
}

export interface ReconcilingItem {
  id: string;
  date: string;
  particulars: string;
  /** Cheque or receipt number — how the item is traced on the statement. */
  ref?: string;
  amount: Cents;
}

export interface Reconciliation {
  perCashBook: Cents;
  /** In the book, not yet on the statement: deposits the bank has not credited. */
  uncredited: ReconcilingItem[];
  uncreditedTotal: Cents;
  /** Paid in the book, not yet out of the bank: cheques not presented. */
  unpresented: ReconcilingItem[];
  unpresentedTotal: Cents;
  /** What the statement should read if timing differences are all that remain. */
  expectedStatement: Cents;
  statementBalance: Cents;
  /**
   * What the statement holds that the book does not. Negative is money the
   * bank has taken and the book has not recorded — charges are the usual
   * cause. It is never inferred: it is only ever the arithmetic difference,
   * and the entries behind it must be read off the statement and posted.
   */
  difference: Cents;
  reconciled: boolean;
}

/**
 * The bank reconciliation statement. Timing differences are listed, never
 * assumed: an item is outstanding because the bursar has not ticked it off
 * against the statement, not because the system guessed.
 */
export function buildReconciliation(input: {
  perCashBook: Cents;
  txns: Txn[];
  cleared: Set<string>;
  statementBalance: Cents;
}): Reconciliation {
  const { perCashBook, txns, cleared, statementBalance } = input;

  const uncredited: ReconcilingItem[] = [];
  const unpresented: ReconcilingItem[] = [];

  for (const t of txns) {
    const effect = bankEffect(t);
    if (effect === 0 || cleared.has(t.id)) continue;

    const item: ReconcilingItem = {
      id: t.id,
      date: t.date,
      particulars: t.particulars,
      ref: t.kind === "receipt" ? t.receiptNo : t.chequeNo,
      amount: Math.abs(effect),
    };
    (effect > 0 ? uncredited : unpresented).push(item);
  }

  const total = (xs: ReconcilingItem[]) => xs.reduce((a, x) => a + x.amount, 0);
  const uncreditedTotal = total(uncredited);
  const unpresentedTotal = total(unpresented);
  const expectedStatement = perCashBook - uncreditedTotal + unpresentedTotal;

  return {
    perCashBook,
    uncredited, uncreditedTotal,
    unpresented, unpresentedTotal,
    expectedStatement,
    statementBalance,
    difference: statementBalance - expectedStatement,
    reconciled: statementBalance - expectedStatement === 0,
  };
}
