import { describe, expect, it } from "vitest";
import { buildPeriodStatement, priorPeriod, type BookYear } from "../period-statement";
import { toCents } from "../money";
import type { Txn, VoteHead } from "../types";

// Invented figures. Never a real school's.
const heads: VoteHead[] = [
  { code: "EXB", name: "Exercise books", order: 1 },
  { code: "STN", name: "Stationery", order: 2 },
  { code: "BCH", name: "Bank charges", order: 3 },
];

const receipt = (id: string, date: string, amount: number, code: string): Txn => ({
  id, date, kind: "receipt", particulars: "r", cash: 0, bank: toCents(amount),
  allocations: [{ voteHeadCode: code, amount: toCents(amount) }],
});
const payment = (id: string, date: string, amount: number, code: string): Txn => ({
  id, date, kind: "payment", particulars: "p", cash: 0, bank: toCents(amount),
  allocations: [{ voteHeadCode: code, amount: toCents(amount) }],
});

const fy1: BookYear = {
  startsOn: "2024-07-01", endsOn: "2025-06-30", opening: { cash: 0, bank: toCents(1000) },
  txns: [
    receipt("a", "2024-09-01", 5000, "EXB"),
    payment("b", "2025-02-01", 2000, "STN"),
    receipt("c", "2025-05-01", 3000, "STN"),
  ],
};
// Carried forward: 1,000 + 5,000 - 2,000 + 3,000 = 7,000.
const fy2: BookYear = {
  startsOn: "2025-07-01", endsOn: "2026-06-30", opening: { cash: 0, bank: toCents(7000) },
  txns: [
    payment("d", "2025-08-01", 4000, "EXB"),
    payment("e", "2025-12-31", 50, "BCH"),
    receipt("f", "2026-01-10", 900, "STN"),
  ],
};

describe("buildPeriodStatement", () => {
  it("reads a calendar year across two financial-year books", () => {
    const s = buildPeriodStatement(heads, [fy1, fy2], "2025-01-01", "2025-12-31");
    expect(s.complete).toBe(true);
    // 1,000 + 5,000 before 1 January.
    expect(s.broughtForward.bank).toBe(toCents(6000));
    expect(s.income).toEqual([{ code: "STN", name: "Stationery", amount: toCents(3000) }]);
    expect(s.expenditure.map((l) => [l.code, l.amount])).toEqual([
      ["EXB", toCents(4000)], ["STN", toCents(2000)], ["BCH", toCents(50)],
    ]);
    expect(s.surplus).toBe(toCents(3000 - 6050));
    expect(s.closing.bank).toBe(toCents(6000 + 3000 - 6050));
    expect(s.carriedDifference).toBe(0);
  });

  it("keeps the accumulated fund equal to the cash and bank it stands for", () => {
    const s = buildPeriodStatement(heads, [fy1, fy2], "2024-10-15", "2026-02-28");
    const fund = s.broughtForward.cash + s.broughtForward.bank + s.surplus;
    expect(fund).toBe(s.closing.cash + s.closing.bank);
  });

  it("is incomplete when the books do not reach back to the start, and claims no gap", () => {
    const s = buildPeriodStatement(heads, [fy2], "2025-01-01", "2025-12-31");
    expect(s.complete).toBe(false);
    expect(s.carriedDifference).toBe(0);
  });

  it("is incomplete when a year inside the period is missing", () => {
    const fy3: BookYear = { startsOn: "2026-07-01", endsOn: "2027-06-30", opening: { cash: 0, bank: 0 }, txns: [] };
    expect(buildPeriodStatement(heads, [fy1, fy3], "2025-01-01", "2026-12-31").complete).toBe(false);
  });

  it("ignores a gap outside the period", () => {
    const old: BookYear = { startsOn: "2022-07-01", endsOn: "2023-06-30", opening: { cash: 0, bank: 0 }, txns: [] };
    expect(buildPeriodStatement(heads, [old, fy1, fy2], "2025-01-01", "2025-12-31").complete).toBe(true);
  });

  it("reports an opening balance that was not carried forward", () => {
    const short = { ...fy2, opening: { cash: 0, bank: toCents(6500) } };
    const s = buildPeriodStatement(heads, [fy1, short], "2025-01-01", "2025-12-31");
    expect(s.carriedDifference).toBe(toCents(500));
  });
});

describe("priorPeriod", () => {
  it("steps a calendar year back a whole year", () => {
    expect(priorPeriod("2025-01-01", "2025-12-31")).toEqual({ from: "2024-01-01", to: "2024-12-31" });
  });
  it("steps half a year back six months", () => {
    expect(priorPeriod("2026-01-01", "2026-06-30")).toEqual({ from: "2025-07-01", to: "2025-12-31" });
  });
  it("steps an odd span back by the same number of days", () => {
    expect(priorPeriod("2025-03-10", "2025-03-19")).toEqual({ from: "2025-02-28", to: "2025-03-09" });
  });
});
