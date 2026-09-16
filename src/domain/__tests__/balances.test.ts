import { describe, expect, it } from "vitest";
import { balancesAfter } from "../balances";
import { toCents } from "../money";
import type { Txn } from "../types";

const opening = { cash: toCents(100), bank: toCents(900) };

const receipt: Txn = {
  id: "r", date: "2025-10-03", kind: "receipt", particulars: "capitation",
  cash: toCents(50), bank: toCents(400),
  allocations: [{ voteHeadCode: "EXB", amount: toCents(450) }],
};
const payment: Txn = {
  id: "p", date: "2025-10-09", kind: "payment", particulars: "supplier",
  cash: toCents(20), bank: toCents(300),
  allocations: [{ voteHeadCode: "EXB", amount: toCents(320) }],
};

describe("balancesAfter", () => {
  it("returns the opening balances when nothing has moved", () => {
    expect(balancesAfter(opening, [])).toEqual(opening);
  });

  it("adds receipts and subtracts payments on each side", () => {
    expect(balancesAfter(opening, [receipt, payment])).toEqual({
      cash: toCents(100 + 50 - 20),
      bank: toCents(900 + 400 - 300),
    });
  });

  it("moves cash to bank on a banking contra", () => {
    const contra: Txn = {
      id: "c", date: "2025-10-04", kind: "contra", particulars: "banking",
      from: "cash", to: "bank", amount: toCents(60),
    };
    expect(balancesAfter(opening, [contra])).toEqual({
      cash: toCents(40), bank: toCents(960),
    });
  });

  it("moves bank to cash on a withdrawal contra", () => {
    const contra: Txn = {
      id: "c", date: "2025-10-04", kind: "contra", particulars: "cash drawn",
      from: "bank", to: "cash", amount: toCents(75),
    };
    expect(balancesAfter(opening, [contra])).toEqual({
      cash: toCents(175), bank: toCents(825),
    });
  });

  it("leaves the combined total untouched across a contra", () => {
    const contra: Txn = {
      id: "c", date: "2025-10-04", kind: "contra", particulars: "banking",
      from: "cash", to: "bank", amount: toCents(60),
    };
    const after = balancesAfter(opening, [contra]);
    expect(after.cash + after.bank).toBe(opening.cash + opening.bank);
  });

  it("does not mutate the opening balances it was given", () => {
    const start = { cash: toCents(100), bank: toCents(900) };
    balancesAfter(start, [receipt, payment]);
    expect(start).toEqual({ cash: toCents(100), bank: toCents(900) });
  });
});
