import { sum } from "./money";
import type { Txn } from "./types";

/** Invariants 1 and 2. Returns [] when the transaction may be saved. */
export function validateTransaction(t: Txn, voteHeadCodes: string[]): string[] {
  const errors: string[] = [];

  if (t.kind === "contra") {
    if (t.from === t.to) errors.push("A contra must move money between cash and bank.");
    if (t.amount <= 0) errors.push("Amount must be greater than zero.");
    return errors;
  }

  const total = t.cash + t.bank;
  if (t.cash < 0 || t.bank < 0) errors.push("Cash and bank cannot be negative.");
  if (total <= 0) errors.push("Amount must be greater than zero.");
  if (t.allocations.length === 0) errors.push("Allocate the amount to at least one vote head.");

  for (const a of t.allocations) {
    if (a.amount <= 0) errors.push(`Allocation to ${a.voteHeadCode} must be greater than zero.`);
    if (!voteHeadCodes.includes(a.voteHeadCode))
      errors.push(`${a.voteHeadCode} is not a vote head on this account.`);
  }

  const allocated = sum(t.allocations.map((a) => a.amount));
  if (allocated !== total)
    errors.push(
      `Allocations come to ${allocated / 100} but cash + bank is ${total / 100}. They must agree.`,
    );

  return errors;
}
