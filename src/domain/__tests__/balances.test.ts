import { describe, expect, it } from "vitest";
import { balancesAfter, cashAsAt, cashAvailableAsAt, cashMoves } from "../balances";
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

describe("cashAvailableAsAt", () => {
  const bankWithdrawal: Txn = {
    id: "w", date: "2025-10-05", kind: "contra", particulars: "cash drawn",
    from: "bank", to: "cash", amount: toCents(200),
  };

  it("counts only what had happened by that date, like voteBalancesAsAt", () => {
    // The payment on the 9th is judged against the day, not the year: the
    // receipt on the 3rd counts, the withdrawal on the 5th counts, but
    // nothing after the 9th does.
    expect(cashAvailableAsAt(opening.cash, [receipt, bankWithdrawal, payment], "2025-10-09"))
      .toBe(toCents(100 + 50 + 200 - 20));
  });

  it("excludes entries that fall after the date", () => {
    expect(cashAvailableAsAt(opening.cash, [receipt, bankWithdrawal, payment], "2025-10-04"))
      .toBe(toCents(100 + 50));
  });

  it("includes an entry on the day itself", () => {
    expect(cashAvailableAsAt(opening.cash, [receipt], "2025-10-03")).toBe(toCents(150));
  });

  it("excludes a transaction by id, so amending it does not count it twice", () => {
    expect(cashAvailableAsAt(opening.cash, [receipt, payment], "2025-10-09", "payment-excl", ))
      .toBe(toCents(100 + 50 - 20));
    expect(cashAvailableAsAt(opening.cash, [receipt, payment], "2025-10-09", "p"))
      .toBe(toCents(100 + 50));
  });

  it("is nil beyond opening for a date before anything happened", () => {
    expect(cashAvailableAsAt(opening.cash, [receipt], "2025-10-01")).toBe(opening.cash);
  });
});

describe("cashAsAt", () => {
  // The payment form shows cash from the moves; the server refuses from the
  // transactions. The two must never disagree on any date.
  it("agrees with cashAvailableAsAt on every date", () => {
    const draw: Txn = {
      id: "c", date: "2025-10-05", kind: "contra", particulars: "draw",
      from: "bank", to: "cash", amount: toCents(70),
    };
    const txns = [receipt, draw, payment];
    for (const d of ["2025-10-01", "2025-10-03", "2025-10-05", "2025-10-09", "2025-10-31"]) {
      expect(cashAsAt(opening.cash, cashMoves(txns), d)).toBe(cashAvailableAsAt(opening.cash, txns, d));
    }
  });
});
