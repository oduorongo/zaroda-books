import type { Cents } from "./money";
import { balancesAfter } from "./balances";
import type { Balances, Txn, VoteHead } from "./types";
import type { AccountType } from "./vote-heads";

/**
 * The IPSAS internal annual audit report, as the county schools auditors lay
 * it out: one statement set for the whole school, every account in it, with
 * the prior year beside it.
 *
 * Every figure is derived from the books and nothing else. The auditor writes
 * the findings; they do not type a number. That is what keeps the fund
 * brought forward equal to last year's closing, and the net financial
 * position equal to the net financial assets — the two places hand-made
 * reports most often disagree with themselves.
 */

/** The funds the report's notes are grouped by. KPEEL has no book here. */
export type IpsasFund = "tuition" | "operations" | "infrastructure" | "schoolFund";

export const IPSAS_FUNDS: IpsasFund[] = ["tuition", "operations", "infrastructure", "schoolFund"];

/** Boarding and lunch are both parents' money: one school fund in the report. */
export const IPSAS_FUND_OF: Record<AccountType, IpsasFund> = {
  TUITION: "tuition",
  OPERATIONS: "operations",
  INFRASTRUCTURE: "infrastructure",
  BOARDING: "schoolFund",
  LUNCH: "schoolFund",
};

/** One account's book for one financial year. */
export interface AccountYear {
  type: AccountType;
  heads: VoteHead[];
  opening: Balances;
  txns: Txn[];
}

export interface IpsasLine { code: string; name: string; amount: Cents }

export interface IpsasYear {
  /** Received per vote head, per fund — notes 1 to 4. */
  receipts: Record<IpsasFund, IpsasLine[]>;
  /** Spent per vote head, per fund — notes 6 to 9. */
  payments: Record<IpsasFund, IpsasLine[]>;
  totalReceipts: Cents;
  totalPayments: Cents;
  /** Receipts less payments. */
  surplus: Cents;
  /** Cash and bank per fund at the start and end of the year — notes 11 to 13. */
  opening: Record<IpsasFund, Balances>;
  closing: Record<IpsasFund, Balances>;
  openingTotal: Balances;
  closingTotal: Balances;
}

const perFund = <T>(make: () => T): Record<IpsasFund, T> =>
  Object.fromEntries(IPSAS_FUNDS.map((f) => [f, make()])) as Record<IpsasFund, T>;

const sum = (xs: Balances[]): Balances =>
  xs.reduce((a, b) => ({ cash: a.cash + b.cash, bank: a.bank + b.bank }), { cash: 0, bank: 0 });

/** Adds each allocation to its head's line, keeping the chart's order. */
function addLines(lines: IpsasLine[], heads: VoteHead[], txns: Txn[], kind: "receipt" | "payment") {
  const byCode = new Map(lines.map((l) => [l.code, l]));
  for (const h of [...heads].sort((a, b) => a.order - b.order)) {
    let amount = 0;
    for (const t of txns) {
      if (t.kind !== kind) continue;
      for (const a of t.allocations) if (a.voteHeadCode === h.code) amount += a.amount;
    }
    if (!amount) continue;
    const line = byCode.get(h.code);
    if (line) line.amount += amount;
    else {
      const fresh = { code: h.code, name: h.name, amount };
      lines.push(fresh);
      byCode.set(h.code, fresh);
    }
  }
}

/** One year's statement set, from every book the school kept that year. */
export function buildIpsasYear(books: AccountYear[]): IpsasYear {
  const receipts = perFund<IpsasLine[]>(() => []);
  const payments = perFund<IpsasLine[]>(() => []);
  const opening = perFund<Balances[]>(() => []);
  const closing = perFund<Balances[]>(() => []);

  for (const b of books) {
    const fund = IPSAS_FUND_OF[b.type];
    addLines(receipts[fund], b.heads, b.txns, "receipt");
    addLines(payments[fund], b.heads, b.txns, "payment");
    opening[fund].push(b.opening);
    closing[fund].push(balancesAfter(b.opening, b.txns));
  }

  const total = (r: Record<IpsasFund, IpsasLine[]>) =>
    IPSAS_FUNDS.reduce((a, f) => a + r[f].reduce((x, l) => x + l.amount, 0), 0);
  const totalReceipts = total(receipts);
  const totalPayments = total(payments);
  const openingByFund = perFund<Balances>(() => ({ cash: 0, bank: 0 }));
  const closingByFund = perFund<Balances>(() => ({ cash: 0, bank: 0 }));
  for (const f of IPSAS_FUNDS) {
    openingByFund[f] = sum(opening[f]);
    closingByFund[f] = sum(closing[f]);
  }

  return {
    receipts,
    payments,
    totalReceipts,
    totalPayments,
    surplus: totalReceipts - totalPayments,
    opening: openingByFund,
    closing: closingByFund,
    openingTotal: sum(IPSAS_FUNDS.map((f) => openingByFund[f])),
    closingTotal: sum(IPSAS_FUNDS.map((f) => closingByFund[f])),
  };
}

/** A note line with its comparative. Null prior means there was no prior year. */
export interface IpsasRow { code: string; name: string; current: Cents; prior: Cents | null }

export interface IpsasComparison {
  current: IpsasYear;
  prior: IpsasYear | null;
  receipts: Record<IpsasFund, IpsasRow[]>;
  payments: Record<IpsasFund, IpsasRow[]>;
  /**
   * This year's opening cash and bank less last year's closing. Nil when the
   * books were carried forward; anything else is a gap the auditor must see,
   * so it is reported, never absorbed into the accumulated fund.
   */
  broughtForwardDifference: Cents | null;
}

function compareLines(current: IpsasLine[], prior: IpsasLine[] | null): IpsasRow[] {
  const rows: IpsasRow[] = current.map((l) => ({
    code: l.code, name: l.name, current: l.amount,
    prior: prior ? prior.find((p) => p.code === l.code)?.amount ?? 0 : null,
  }));
  // A head used last year and not this year still shows, at nil.
  for (const p of prior ?? []) {
    if (!current.some((l) => l.code === p.code)) {
      rows.push({ code: p.code, name: p.name, current: 0, prior: p.amount });
    }
  }
  return rows;
}

/** The year beside the one before it, as the report prints them. */
export function compareIpsas(current: IpsasYear, prior: IpsasYear | null): IpsasComparison {
  const receipts = perFund<IpsasRow[]>(() => []);
  const payments = perFund<IpsasRow[]>(() => []);
  for (const f of IPSAS_FUNDS) {
    receipts[f] = compareLines(current.receipts[f], prior?.receipts[f] ?? null);
    payments[f] = compareLines(current.payments[f], prior?.payments[f] ?? null);
  }
  const total = (b: Balances) => b.cash + b.bank;
  return {
    current,
    prior,
    receipts,
    payments,
    broughtForwardDifference: prior ? total(current.openingTotal) - total(prior.closingTotal) : null,
  };
}

/** One capitation receipt into the tuition or operations book. */
export interface Grant { fund: "tuition" | "operations"; date: string; amount: Cents }

export interface DisbursementRow { tuition: Cents | null; operations: Cents | null; total: Cents }

/**
 * The background table of grants: the nth disbursement to each account side
 * by side, in date order. A disbursement that reached only one account shows
 * nil on the other, as the Ministry's tranches sometimes do.
 */
export function disbursementRows(grants: Grant[]): DisbursementRow[] {
  const side = (fund: Grant["fund"]) =>
    grants.filter((g) => g.fund === fund).sort((a, b) => a.date.localeCompare(b.date)).map((g) => g.amount);
  const tuition = side("tuition");
  const operations = side("operations");
  return Array.from({ length: Math.max(tuition.length, operations.length) }, (_, i) => ({
    tuition: tuition[i] ?? null,
    operations: operations[i] ?? null,
    total: (tuition[i] ?? 0) + (operations[i] ?? 0),
  }));
}
