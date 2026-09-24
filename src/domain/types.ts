import type { Cents } from "./money.ts";

export interface Allocation {
  voteHeadCode: string;
  amount: Cents;
}

interface Base {
  id: string;
  date: string; // ISO yyyy-mm-dd
  particulars: string;
}

export interface Receipt extends Base {
  kind: "receipt";
  receiptNo?: string;
  cash: Cents;
  bank: Cents;
  allocations: Allocation[];
}

export interface Payment extends Base {
  kind: "payment";
  vrNo?: string;
  chequeNo?: string;
  /** Printed on the voucher only: "Being payment for ...". */
  narration?: string;
  cash: Cents;
  bank: Cents;
  allocations: Allocation[];
}

/**
 * A contra is one event with two legs (CASH TO BANK / CASH FROM BANK).
 * It has no `allocations` field at all, so invariant 2 cannot be violated.
 */
export interface Contra extends Base {
  kind: "contra";
  from: "cash" | "bank";
  to: "cash" | "bank";
  amount: Cents;
  chequeNo?: string;
}

export type Txn = Receipt | Payment | Contra;

/** A transaction before it is saved. Distributes over the union so `kind` still narrows. */
export type NewTxn = Txn extends infer T ? (T extends Txn ? Omit<T, "id"> : never) : never;

export interface Balances {
  cash: Cents;
  bank: Cents;
}

export interface VoteHead {
  code: string;
  name: string;
  order: number;
}
