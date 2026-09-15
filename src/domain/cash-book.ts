import type { Cents } from "./money";
import type { Balances, Txn, VoteHead } from "./types";

export interface CashBookRow {
  date: string;
  particulars: string;
  ref?: string;
  chequeNo?: string;
  cash: Cents;
  bank: Cents;
  total: Cents; // contra legs are always 0 — they are not income or expenditure
  analysis: Record<string, Cents>;
}

export interface CashBook {
  receipts: CashBookRow[];
  payments: CashBookRow[];
  opening: Balances;
  closing: Balances;
  receiptTotals: { cash: Cents; bank: Cents; total: Cents; analysis: Record<string, Cents> };
  paymentTotals: { cash: Cents; bank: Cents; total: Cents; analysis: Record<string, Cents> };
}

const blank = (heads: VoteHead[]) =>
  Object.fromEntries(heads.map((h) => [h.code, 0])) as Record<string, Cents>;

const analysisOf = (t: Extract<Txn, { allocations: unknown }>, heads: VoteHead[]) => {
  const a = blank(heads);
  for (const alloc of t.allocations) a[alloc.voteHeadCode] = (a[alloc.voteHeadCode] ?? 0) + alloc.amount;
  return a;
};

/** Builds one month's analysed cash book. Nothing here is stored — it is derived every time. */
export function buildCashBook(opening: Balances, txns: Txn[], heads: VoteHead[]): CashBook {
  const receipts: CashBookRow[] = [];
  const payments: CashBookRow[] = [];

  for (const t of [...txns].sort((a, b) => a.date.localeCompare(b.date))) {
    if (t.kind === "receipt") {
      receipts.push({
        date: t.date, particulars: t.particulars, ref: t.receiptNo,
        cash: t.cash, bank: t.bank, total: t.cash + t.bank, analysis: analysisOf(t, heads),
      });
    } else if (t.kind === "payment") {
      payments.push({
        date: t.date, particulars: t.particulars, ref: t.vrNo, chequeNo: t.chequeNo,
        cash: t.cash, bank: t.bank, total: t.cash + t.bank, analysis: analysisOf(t, heads),
      });
    } else {
      const leg = (side: "cash" | "bank") => ({
        date: t.date,
        particulars: t.from === "cash" ? "Cash to bank" : "Cash from bank",
        ref: "C",
        chequeNo: t.chequeNo,
        cash: side === "cash" ? t.amount : 0,
        bank: side === "bank" ? t.amount : 0,
        total: 0,
        analysis: blank(heads),
      });
      receipts.push(leg(t.to));
      payments.push(leg(t.from));
    }
  }

  const fold = (rows: CashBookRow[]) => {
    const analysis = blank(heads);
    let cash = 0, bank = 0, total = 0;
    for (const r of rows) {
      cash += r.cash; bank += r.bank; total += r.total;
      for (const h of heads) analysis[h.code] += r.analysis[h.code] ?? 0;
    }
    return { cash, bank, total, analysis };
  };

  const receiptTotals = fold(receipts);
  const paymentTotals = fold(payments);

  return {
    receipts, payments, opening, receiptTotals, paymentTotals,
    closing: {
      cash: opening.cash + receiptTotals.cash - paymentTotals.cash,
      bank: opening.bank + receiptTotals.bank - paymentTotals.bank,
    },
  };
}
