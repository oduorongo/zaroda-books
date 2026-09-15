import { toCents, CHART_OF_ACCOUNTS } from "@/domain";
import type { Balances, Txn } from "@/domain";

/**
 * Real figures from the Ong'ora Kakuru SIMBA account, 2025/26.
 * Delete this module once the database is wired up — it exists so the app runs
 * and deploys before any data exists.
 */
export const demoHeads = CHART_OF_ACCOUNTS.SIMBA;
export const demoOpening: Balances = { cash: 0, bank: toCents(1903.45) };

export const demoTxns: Txn[] = [
  {
    id: "r1", date: "2025-10-03", kind: "receipt", particulars: "MoE capitation", receiptNo: "001",
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
  {
    id: "r2", date: "2026-01-02", kind: "receipt", particulars: "MoE capitation", receiptNo: "002",
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
    id: "r3", date: "2026-04-01", kind: "receipt", particulars: "MoE capitation", receiptNo: "003",
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
    vrNo: "1", chequeNo: "000121", cash: 0, bank: toCents(70000),
    allocations: [{ voteHeadCode: "STN", amount: toCents(70000) }],
  },
];

export const inMonth = (month: string) => demoTxns.filter((t) => t.date.startsWith(month));
export const upTo = (month: string) => demoTxns.filter((t) => t.date <= `${month}-31`);
