import { test, expect } from "vitest";
import {
  toCents, validateTransaction, buildCashBook, buildTrialBalance,
  allocateCapitation, CHART_OF_ACCOUNTS,
} from "@/domain";
import type { Txn } from "@/domain";

const heads = CHART_OF_ACCOUNTS.SIMBA;
const codes = heads.map((h) => h.code);

// --- Invariant 1: allocations must equal cash + bank -------------------------
test("rejects a receipt whose allocations do not equal cash plus bank", () => {
  const t: Txn = {
    id: "1", date: "2025-10-03", kind: "receipt", particulars: "MoE grant",
    cash: toCents(24269), bank: 0,
    allocations: [{ voteHeadCode: "TXB", amount: toCents(7282) }],
  };
  expect(validateTransaction(t, codes)).toHaveLength(1);
});

test("accepts a receipt that cross-casts", () => {
  const t: Txn = {
    id: "1", date: "2025-10-03", kind: "receipt", particulars: "MoE grant",
    cash: toCents(24269), bank: 0,
    allocations: [
      { voteHeadCode: "TXB", amount: toCents(7282) },
      { voteHeadCode: "TXM", amount: toCents(729) },
      { voteHeadCode: "EXB", amount: toCents(10194) },
      { voteHeadCode: "TGR", amount: toCents(3640) },
      { voteHeadCode: "STN", amount: toCents(2424) },
    ],
  };
  expect(validateTransaction(t, codes)).toEqual([]);
});

// --- Invariant 2: a contra never touches a vote head ------------------------
test("a contra produces two legs, both with a zero total", () => {
  const contra: Txn = {
    id: "2", date: "2025-10-03", kind: "contra", particulars: "banking",
    from: "cash", to: "bank", amount: toCents(24269),
  };
  const cb = buildCashBook({ cash: 0, bank: toCents(1903.45) }, [contra], heads);
  expect(cb.receipts.length).toBe(1);
  expect(cb.payments.length).toBe(1);
  expect(cb.receiptTotals.total).toBe(0);
  expect(cb.paymentTotals.total).toBe(0);
  expect(cb.closing.cash).toBe(toCents(-24269));
  expect(cb.closing.bank).toBe(toCents(1903.45 + 24269));
});

// --- Golden master: Ong'ora Kakuru SIMBA account, October 2025 --------------
test("reproduces the October 2025 SIMBA trial balance", () => {
  const txns: Txn[] = [
    {
      id: "r1", date: "2025-10-03", kind: "receipt", particulars: "MoE capitation",
      cash: toCents(24269), bank: 0,
      allocations: [
        { voteHeadCode: "TXB", amount: toCents(7282) },
        { voteHeadCode: "TXM", amount: toCents(729) },
        { voteHeadCode: "EXB", amount: toCents(10194) },
        { voteHeadCode: "TGR", amount: toCents(3640) },
        { voteHeadCode: "STN", amount: toCents(2424) },
      ],
    },
    {
      id: "c1", date: "2025-10-03", kind: "contra", particulars: "banking",
      from: "cash", to: "bank", amount: toCents(24269),
    },
  ];

  const tb = buildTrialBalance("2025-10-31", { cash: 0, bank: toCents(1903.45) }, txns, heads);

  expect(tb.closingCash).toBe(0);
  expect(tb.closingBank).toBe(toCents(26172.45));
  expect(tb.totalDr).toBe(toCents(26172.45));
  expect(tb.totalCr).toBe(toCents(26172.45));
  expect(tb.balanced).toBe(true);
});

test("reproduces the May 2026 SIMBA trial balance after a 70,000 payment", () => {
  const txns: Txn[] = [
    {
      id: "r1", date: "2025-10-03", kind: "receipt", particulars: "MoE capitation",
      cash: 0, bank: toCents(24269),
      allocations: [
        { voteHeadCode: "TXB", amount: toCents(7282) },
        { voteHeadCode: "TXM", amount: toCents(729) },
        { voteHeadCode: "EXB", amount: toCents(10194) },
        { voteHeadCode: "TGR", amount: toCents(3640) },
        { voteHeadCode: "STN", amount: toCents(2424) },
      ],
    },
    {
      id: "r2", date: "2026-01-02", kind: "receipt", particulars: "MoE capitation",
      cash: 0, bank: toCents(46425.2),
      allocations: [
        { voteHeadCode: "TXB", amount: toCents(3962.4) },
        { voteHeadCode: "TXM", amount: toCents(1826) },
        { voteHeadCode: "EXB", amount: toCents(25481) },
        { voteHeadCode: "TGR", amount: toCents(9096.8) },
        { voteHeadCode: "STN", amount: toCents(6059) },
      ],
    },
    {
      id: "r3", date: "2026-04-01", kind: "receipt", particulars: "MoE capitation",
      cash: 0, bank: toCents(15811.5),
      allocations: [
        { voteHeadCode: "TXM", amount: toCents(830) },
        { voteHeadCode: "EXB", amount: toCents(6640) },
        { voteHeadCode: "TGR", amount: toCents(2490) },
        { voteHeadCode: "STN", amount: toCents(5851.5) },
      ],
    },
    {
      id: "p1", date: "2026-05-14", kind: "payment", particulars: "Stationery supplier",
      cash: 0, bank: toCents(70000), vrNo: "1",
      allocations: [{ voteHeadCode: "STN", amount: toCents(70000) }],
    },
  ];

  const tb = buildTrialBalance("2026-05-31", { cash: 0, bank: toCents(1903.45) }, txns, heads);

  expect(tb.closingBank).toBe(toCents(18409.15));
  expect(tb.totalDr).toBe(toCents(88409.15));
  expect(tb.totalCr).toBe(toCents(88409.15));
  expect(tb.balanced).toBe(true);
});

// --- Capitation -------------------------------------------------------------
test("capitation splits to the exact cent and never derives enrolment", () => {
  const allocations = allocateCapitation(
    toCents(24269.2),
    166,
    [
      { voteHeadCode: "TXB", perLearner: toCents(43.87) },
      { voteHeadCode: "TXM", perLearner: toCents(4.39) },
      { voteHeadCode: "EXB", perLearner: toCents(61.41) },
      { voteHeadCode: "TGR", perLearner: toCents(21.93) },
      { voteHeadCode: "STN", perLearner: toCents(14.6) },
    ],
  );
  const total = allocations.reduce((a, x) => a + x.amount, 0);
  expect(total).toBe(toCents(24269.2));
});

test("refuses a fractional enrolment", () => {
  expect(() =>
    allocateCapitation(toCents(46425.2), 165.9999285, [
      { voteHeadCode: "TXB", perLearner: toCents(23.87) },
    ]),
  ).toThrow();
});
