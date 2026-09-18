import { describe, expect, it } from "vitest";
import { bankEffect, buildReconciliation, monthEndExclusive } from "../reconciliation";
import { toCents } from "../money";
import type { Txn } from "../types";

const receipt = (id: string, date: string, bank: number): Txn => ({
  id, date, kind: "receipt", particulars: `Receipt ${id}`,
  cash: 0, bank: toCents(bank), allocations: [{ voteHeadCode: "LAB", amount: toCents(bank) }],
});

const payment = (id: string, date: string, bank: number, chequeNo?: string): Txn => ({
  id, date, kind: "payment", particulars: `Payment ${id}`, chequeNo,
  cash: 0, bank: toCents(bank), allocations: [{ voteHeadCode: "LAB", amount: toCents(bank) }],
});

const banking = (id: string, date: string, amount: number): Txn => ({
  id, date, kind: "contra", particulars: "Banking",
  from: "cash", to: "bank", amount: toCents(amount),
});

describe("bankEffect", () => {
  it("is what the entry does to the bank column", () => {
    expect(bankEffect(receipt("r", "2026-07-01", 100))).toBe(toCents(100));
    expect(bankEffect(payment("p", "2026-07-01", 40))).toBe(toCents(-40));
    expect(bankEffect(banking("c", "2026-07-01", 60))).toBe(toCents(60));
  });

  it("is negative for cash drawn from the bank", () => {
    const drawing: Txn = {
      id: "d", date: "2026-07-01", kind: "contra", particulars: "Cash drawn",
      from: "bank", to: "cash", amount: toCents(25),
    };
    expect(bankEffect(drawing)).toBe(toCents(-25));
  });

  it("is zero for an entry that never touched the bank", () => {
    expect(bankEffect(receipt("r", "2026-07-01", 0))).toBe(0);
  });
});

describe("buildReconciliation", () => {
  const txns = [
    receipt("r1", "2026-07-03", 1000),
    banking("c1", "2026-07-10", 500),
    payment("p1", "2026-07-12", 200, "001234"),
    payment("p2", "2026-07-28", 300, "001235"),
  ];

  it("reconciles when everything has cleared and the statement agrees", () => {
    const r = buildReconciliation({
      perCashBook: toCents(1000),
      txns,
      cleared: new Set(["r1", "c1", "p1", "p2"]),
      statementBalance: toCents(1000),
    });
    expect(r.uncredited).toHaveLength(0);
    expect(r.unpresented).toHaveLength(0);
    expect(r.difference).toBe(0);
    expect(r.reconciled).toBe(true);
  });

  it("adds back a deposit the bank has not credited", () => {
    const r = buildReconciliation({
      perCashBook: toCents(1000),
      txns,
      cleared: new Set(["r1", "p1", "p2"]),
      statementBalance: toCents(500),
    });
    expect(r.uncredited.map((l) => l.id)).toEqual(["c1"]);
    expect(r.uncreditedTotal).toBe(toCents(500));
    expect(r.reconciled).toBe(true);
  });

  it("takes off a cheque the bank has not paid", () => {
    const r = buildReconciliation({
      perCashBook: toCents(1000),
      txns,
      cleared: new Set(["r1", "c1", "p1"]),
      statementBalance: toCents(1300),
    });
    expect(r.unpresented.map((l) => l.id)).toEqual(["p2"]);
    expect(r.unpresentedTotal).toBe(toCents(300));
    expect(r.reconciled).toBe(true);
  });

  it("shows what the statement holds that the book does not", () => {
    // A 62.61 bank charge on the statement, never entered in the book.
    const r = buildReconciliation({
      perCashBook: toCents(1000),
      txns,
      cleared: new Set(["r1", "c1", "p1", "p2"]),
      statementBalance: toCents(937.39),
    });
    expect(r.difference).toBe(toCents(-62.61));
    expect(r.reconciled).toBe(false);
  });

  it("carries the cheque number, which is how a cheque is traced", () => {
    const r = buildReconciliation({
      perCashBook: toCents(1000),
      txns,
      cleared: new Set(["r1", "c1", "p1"]),
      statementBalance: toCents(1300),
    });
    expect(r.unpresented[0].ref).toBe("001235");
  });

  it("ignores entries that never touched the bank", () => {
    const cashOnly: Txn = {
      id: "x", date: "2026-07-05", kind: "receipt", particulars: "Cash sale",
      cash: toCents(50), bank: 0, allocations: [{ voteHeadCode: "LAB", amount: toCents(50) }],
    };
    const r = buildReconciliation({
      perCashBook: toCents(1000),
      txns: [...txns, cashOnly],
      cleared: new Set(["r1", "c1", "p1", "p2"]),
      statementBalance: toCents(1000),
    });
    expect(r.uncredited).toHaveLength(0);
    expect(r.unpresented).toHaveLength(0);
    expect(r.reconciled).toBe(true);
  });

  it("the statement it produces is the one an auditor reads", () => {
    const r = buildReconciliation({
      perCashBook: toCents(1000),
      txns,
      cleared: new Set(["r1", "p1"]),
      statementBalance: toCents(800),
    });
    // 1000 book, less 500 not yet credited, add back 300 not yet presented.
    expect(r.expectedStatement).toBe(toCents(800));
    expect(r.reconciled).toBe(true);
  });
});

// A month end cannot be fabricated by appending "-31": Postgres parses a date
// column and rejects 30-day months, which is how this reached production.
describe("monthEndExclusive", () => {
  it("is the first day of the month that follows", () => {
    expect(monthEndExclusive("2026-07")).toBe("2026-08-01");
  });

  it("handles a 30-day month", () => {
    expect(monthEndExclusive("2026-09")).toBe("2026-10-01");
  });

  it("handles February in a leap year", () => {
    expect(monthEndExclusive("2028-02")).toBe("2028-03-01");
  });

  it("rolls over the year in December", () => {
    expect(monthEndExclusive("2026-12")).toBe("2027-01-01");
  });

  it("pads a single-digit month", () => {
    expect(monthEndExclusive("2026-08")).toBe("2026-09-01");
  });
});
