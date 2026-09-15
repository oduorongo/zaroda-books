import type { Cents } from "./money";
import type { Txn, VoteHead } from "./types";

/**
 * House convention, taken from the existing workbooks:
 *   a receipt allocated to a vote head CREDITS it (funds voted)
 *   a payment allocated to a vote head DEBITS it (funds spent)
 * so an unspent vote carries a credit balance.
 */
export interface LedgerLine {
  code: string;
  name: string;
  voteDr: Cents;   // this period
  voteCr: Cents;
  prevDr: Cents;   // brought forward
  prevCr: Cents;
  dr: Cents;       // cumulative
  cr: Cents;
}

export function buildLedger(
  txns: Txn[],
  heads: VoteHead[],
  previous: Record<string, { dr: Cents; cr: Cents }> = {},
): LedgerLine[] {
  return heads.map((h) => {
    let voteDr = 0, voteCr = 0;
    for (const t of txns) {
      if (t.kind === "contra") continue;
      for (const a of t.allocations) {
        if (a.voteHeadCode !== h.code) continue;
        if (t.kind === "payment") voteDr += a.amount;
        else voteCr += a.amount;
      }
    }
    const prev = previous[h.code] ?? { dr: 0, cr: 0 };
    return {
      code: h.code, name: h.name,
      voteDr, voteCr, prevDr: prev.dr, prevCr: prev.cr,
      dr: prev.dr + voteDr, cr: prev.cr + voteCr,
    };
  });
}
