import { describe, expect, it } from "vitest";
import { buildCashFlow } from "../cash-flow";
import { toCents } from "../money";
import type { Txn } from "../types";

const txns: Txn[] = [
  {
    id: "1", date: "2025-10-03", kind: "receipt", particulars: "MoE capitation",
    cash: toCents(1000), bank: toCents(4000),
    allocations: [{ voteHeadCode: "TXB", amount: toCents(5000) }],
  },
  {
    id: "2", date: "2025-10-10", kind: "payment", particulars: "Supplier",
    cash: toCents(200), bank: toCents(800),
    allocations: [{ voteHeadCode: "TXB", amount: toCents(1000) }],
  },
  {
    id: "3", date: "2025-10-12", kind: "contra", particulars: "banking",
    from: "cash", to: "bank", amount: toCents(500),
  },
];

describe("buildCashFlow", () => {
  const opening = { cash: toCents(100), bank: toCents(900) };

  it("reports opening, receipts, payments and closing", () => {
    const cf = buildCashFlow("October 2025", opening, txns);
    expect(cf.openingTotal).toBe(toCents(1000));
    expect(cf.receipts).toBe(toCents(5000));
    expect(cf.paymentsCash).toBe(toCents(200));
    expect(cf.paymentsBank).toBe(toCents(800));
  });

  it("closes at opening plus receipts less payments, with contras netting to nil", () => {
    const cf = buildCashFlow("October 2025", opening, txns);
    expect(cf.closingTotal).toBe(toCents(1000 + 5000 - 1000));
    expect(cf.closingCash + cf.closingBank).toBe(cf.closingTotal);
  });

  it("moves cash to bank on a contra without changing the total", () => {
    const cf = buildCashFlow("October 2025", opening, txns);
    expect(cf.closingCash).toBe(toCents(100 + 1000 - 200 - 500));
    expect(cf.closingBank).toBe(toCents(900 + 4000 - 800 + 500));
  });
});
