import { describe, expect, it } from "vitest";
import { buildIpsasYear, compareIpsas, disbursementRows, type AccountYear } from "../ipsas";
import { toCents } from "../money";
import type { Txn, VoteHead } from "../types";

// Invented figures throughout. Never a real school's.
const tuitionHeads: VoteHead[] = [
  { code: "LAB", name: "Laboratory materials", order: 1 },
  { code: "STN", name: "Stationery", order: 2 },
  { code: "BCH", name: "Bank charges", order: 3 },
];
const opsHeads: VoteHead[] = [
  { code: "PE", name: "Personal emoluments", order: 1 },
  { code: "INF", name: "Infrastructure funds", order: 2 },
];
const infraHeads: VoteHead[] = [
  { code: "CIV", name: "Civil works", order: 1 },
  { code: "BCH", name: "Bank charges", order: 2 },
];

const receipt = (id: string, date: string, bank: number, alloc: [string, number][]): Txn => ({
  id, date, kind: "receipt", particulars: "r", cash: 0, bank: toCents(bank),
  allocations: alloc.map(([voteHeadCode, a]) => ({ voteHeadCode, amount: toCents(a) })),
});
const payment = (id: string, date: string, cash: number, bank: number, alloc: [string, number][]): Txn => ({
  id, date, kind: "payment", particulars: "p", cash: toCents(cash), bank: toCents(bank),
  allocations: alloc.map(([voteHeadCode, a]) => ({ voteHeadCode, amount: toCents(a) })),
});

const year1: AccountYear[] = [
  {
    type: "TUITION", heads: tuitionHeads, opening: { cash: 0, bank: toCents(1000) },
    txns: [
      receipt("t1", "2024-08-01", 30000, [["LAB", 10000], ["STN", 20000]]),
      payment("t2", "2024-09-01", 0, 25100, [["STN", 25000], ["BCH", 100]]),
    ],
  },
  {
    type: "OPERATIONS", heads: opsHeads, opening: { cash: 0, bank: toCents(2000) },
    txns: [
      receipt("o1", "2024-08-01", 50000, [["PE", 20000], ["INF", 30000]]),
      payment("o2", "2024-08-05", 0, 30000, [["INF", 30000]]),
      { id: "o3", date: "2024-08-06", kind: "contra", particulars: "draw", from: "bank", to: "cash", amount: toCents(5000) },
      payment("o4", "2024-08-07", 4000, 0, [["PE", 4000]]),
    ],
  },
  {
    type: "INFRASTRUCTURE", heads: infraHeads, opening: { cash: 0, bank: 0 },
    txns: [
      receipt("i1", "2024-08-06", 30000, [["CIV", 30000]]),
      payment("i2", "2024-10-01", 0, 20050, [["CIV", 20000], ["BCH", 50]]),
    ],
  },
];

describe("buildIpsasYear", () => {
  const y = buildIpsasYear(year1);

  it("groups receipts and payments by fund and vote head", () => {
    expect(y.receipts.tuition).toEqual([
      { code: "LAB", name: "Laboratory materials", amount: toCents(10000) },
      { code: "STN", name: "Stationery", amount: toCents(20000) },
    ]);
    expect(y.payments.operations.map((l) => l.code)).toEqual(["PE", "INF"]);
    expect(y.receipts.infrastructure[0].amount).toBe(toCents(30000));
    expect(y.receipts.schoolFund).toEqual([]);
  });

  it("totals receipts and payments across every account", () => {
    expect(y.totalReceipts).toBe(toCents(30000 + 50000 + 30000));
    expect(y.totalPayments).toBe(toCents(25100 + 30000 + 4000 + 20050));
    expect(y.surplus).toBe(y.totalReceipts - y.totalPayments);
  });

  it("closes each fund at its own cash and bank, contras moving between them", () => {
    expect(y.closing.operations).toEqual({ cash: toCents(1000), bank: toCents(17000) });
    expect(y.closing.tuition).toEqual({ cash: 0, bank: toCents(5900) });
  });

  it("keeps net financial assets equal to the accumulated fund plus the surplus", () => {
    const assets = y.closingTotal.cash + y.closingTotal.bank;
    const fund = y.openingTotal.cash + y.openingTotal.bank;
    expect(assets).toBe(fund + y.surplus);
  });

  it("merges boarding and lunch into one school fund", () => {
    const heads: VoteHead[] = [{ code: "BCH", name: "Bank charges", order: 1 }];
    const s = buildIpsasYear([
      { type: "BOARDING", heads, opening: { cash: 0, bank: toCents(100) }, txns: [payment("b", "2024-08-01", 0, 10, [["BCH", 10]])] },
      { type: "LUNCH", heads, opening: { cash: 0, bank: toCents(100) }, txns: [payment("l", "2024-08-01", 0, 20, [["BCH", 20]])] },
    ]);
    expect(s.payments.schoolFund).toEqual([{ code: "BCH", name: "Bank charges", amount: toCents(30) }]);
    expect(s.opening.schoolFund.bank).toBe(toCents(200));
  });
});

describe("compareIpsas", () => {
  const prior = buildIpsasYear(year1);
  const carried = (fund: "tuition" | "operations" | "infrastructure") => prior.closing[fund];

  it("finds no gap when the books were carried forward", () => {
    const current = buildIpsasYear([
      { type: "TUITION", heads: tuitionHeads, opening: carried("tuition"), txns: [] },
      { type: "OPERATIONS", heads: opsHeads, opening: carried("operations"), txns: [] },
      { type: "INFRASTRUCTURE", heads: infraHeads, opening: carried("infrastructure"), txns: [] },
    ]);
    expect(compareIpsas(current, prior).broughtForwardDifference).toBe(0);
  });

  it("reports the gap when an opening balance was not carried forward", () => {
    const current = buildIpsasYear([
      { type: "TUITION", heads: tuitionHeads, opening: carried("tuition"), txns: [] },
      // Cash in hand left out of the balance brought forward.
      { type: "OPERATIONS", heads: opsHeads, opening: { cash: 0, bank: carried("operations").bank }, txns: [] },
      { type: "INFRASTRUCTURE", heads: infraHeads, opening: carried("infrastructure"), txns: [] },
    ]);
    expect(compareIpsas(current, prior).broughtForwardDifference).toBe(-toCents(1000));
  });

  it("shows a head used only last year at nil this year", () => {
    const current = buildIpsasYear([
      { type: "TUITION", heads: tuitionHeads, opening: carried("tuition"),
        txns: [receipt("x", "2025-08-01", 500, [["STN", 500]])] },
    ]);
    const rows = compareIpsas(current, prior).receipts.tuition;
    expect(rows).toEqual([
      { code: "STN", name: "Stationery", current: toCents(500), prior: toCents(20000) },
      { code: "LAB", name: "Laboratory materials", current: 0, prior: toCents(10000) },
    ]);
  });

  it("leaves the comparative empty when there is no prior year", () => {
    const c = compareIpsas(prior, null);
    expect(c.receipts.tuition.every((r) => r.prior === null)).toBe(true);
    expect(c.broughtForwardDifference).toBeNull();
  });
});

describe("disbursementRows", () => {
  it("pairs the nth grant to each account in date order", () => {
    const rows = disbursementRows([
      { fund: "operations", date: "2025-09-02", amount: toCents(200) },
      { fund: "tuition", date: "2025-09-01", amount: toCents(100) },
      { fund: "tuition", date: "2026-01-10", amount: toCents(300) },
      { fund: "operations", date: "2026-01-11", amount: toCents(400) },
      { fund: "operations", date: "2026-05-01", amount: toCents(50) },
    ]);
    expect(rows).toEqual([
      { tuition: toCents(100), operations: toCents(200), total: toCents(300) },
      { tuition: toCents(300), operations: toCents(400), total: toCents(700) },
      { tuition: null, operations: toCents(50), total: toCents(50) },
    ]);
  });
});
