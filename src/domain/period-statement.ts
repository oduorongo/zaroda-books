import type { Cents } from "./money";
import { balancesAfter } from "./balances";
import { addLines, type IpsasLine } from "./ipsas";
import type { Balances, Txn, VoteHead } from "./types";

/**
 * One account's audited statements for a period the auditor sets — the
 * primary school format, whose period need not be a financial year. A
 * January to December period, say, draws on two financial-year books.
 *
 * Nothing is carried in by hand. The fund brought forward is the cash and
 * bank on the first day, read from the financial year that day falls in; the
 * accumulated fund is that plus the surplus, so it cannot disagree with the
 * cash and bank it stands for.
 */

/** One financial year of an account's book. */
export interface BookYear {
  startsOn: string;
  endsOn: string;
  opening: Balances;
  txns: Txn[];
}

export interface PeriodStatement {
  from: string;
  to: string;
  /** False when the books do not reach back to `from` or forward to `to`. */
  complete: boolean;
  broughtForward: Balances;
  income: IpsasLine[];
  expenditure: IpsasLine[];
  totalIncome: Cents;
  totalExpenditure: Cents;
  surplus: Cents;
  closing: Balances;
  /**
   * The closing cash and bank worked forward from `from`, less what the book
   * of the year `to` falls in says. Nil unless a later year's opening balance
   * was not carried forward from the year before.
   */
  carriedDifference: Cents;
}

const yearOf = (years: BookYear[], date: string) =>
  years.find((y) => y.startsOn <= date && date <= y.endsOn);

/** Cash and bank at the start of `date`: that year's opening plus its entries before the day. */
const balanceBefore = (year: BookYear, date: string): Balances =>
  balancesAfter(year.opening, year.txns.filter((t) => t.date < date));

export function buildPeriodStatement(
  heads: VoteHead[], years: BookYear[], from: string, to: string,
): PeriodStatement {
  const first = yearOf(years, from);
  const last = yearOf(years, to);
  // Every day between must be in some year's book, not only the two ends.
  const touched = [...years]
    .filter((y) => y.endsOn >= from && y.startsOn <= to)
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  const unbroken = touched.every((y, i) => i === 0 || y.startsOn <= nextDay(touched[i - 1].endsOn));
  const complete = !!first && !!last && unbroken;

  const txns = years.flatMap((y) => y.txns)
    .filter((t) => from <= t.date && t.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date));
  const broughtForward = first ? balanceBefore(first, from) : { cash: 0, bank: 0 };
  const income: IpsasLine[] = [];
  const expenditure: IpsasLine[] = [];
  addLines(income, heads, txns, "receipt");
  addLines(expenditure, heads, txns, "payment");
  const totalIncome = income.reduce((a, l) => a + l.amount, 0);
  const totalExpenditure = expenditure.reduce((a, l) => a + l.amount, 0);
  const closing = balancesAfter(broughtForward, txns);
  const recorded = last ? balancesAfter(last.opening, last.txns.filter((t) => t.date <= to)) : closing;

  return {
    from, to, complete, broughtForward, income, expenditure, totalIncome, totalExpenditure,
    surplus: totalIncome - totalExpenditure,
    closing,
    // Only meaningful over books that cover the period: with a year missing
    // there is nothing to have carried forward from.
    carriedDifference: complete ? (closing.cash + closing.bank) - (recorded.cash + recorded.bank) : 0,
  };
}

function nextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const lastDayOfMonth = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10) === iso;
};

/**
 * The period of the same length just before, for the comparative column:
 * whole months back when the period is whole months (1 January to 31
 * December gives the previous calendar year), days otherwise.
 */
export function priorPeriod(from: string, to: string): { from: string; to: string } {
  const f = new Date(`${from}T00:00:00Z`);
  const t = new Date(`${to}T00:00:00Z`);
  const priorTo = new Date(f);
  priorTo.setUTCDate(priorTo.getUTCDate() - 1);
  if (f.getUTCDate() === 1 && lastDayOfMonth(to)) {
    const months = (t.getUTCFullYear() - f.getUTCFullYear()) * 12 + t.getUTCMonth() - f.getUTCMonth() + 1;
    const priorFrom = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() - months, 1));
    return { from: priorFrom.toISOString().slice(0, 10), to: priorTo.toISOString().slice(0, 10) };
  }
  const days = Math.round((t.getTime() - f.getTime()) / 86_400_000);
  const priorFrom = new Date(priorTo);
  priorFrom.setUTCDate(priorFrom.getUTCDate() - days);
  return { from: priorFrom.toISOString().slice(0, 10), to: priorTo.toISOString().slice(0, 10) };
}
