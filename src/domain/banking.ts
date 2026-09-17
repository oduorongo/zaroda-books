import type { Cents } from "./money";
import type { Contra } from "./types";

/**
 * Every shilling reaches the school as cash and is then banked, so a receipt
 * and its banking are a pair: the receipt sits in the cash column and this
 * contra carries it across. Rule 3 still holds — the contra touches no vote
 * head, so the money is analysed once, on the receipt.
 */
export function bankingContraFor(
  receipt: { receiptNo?: string; particulars: string; cash: Cents; bank: Cents },
  date: string,
): Omit<Contra, "id"> {
  const amount = receipt.cash + receipt.bank;
  if (amount <= 0) throw new Error("There is nothing to bank on this receipt.");

  return {
    date,
    kind: "contra",
    from: "cash",
    to: "bank",
    amount,
    particulars: `Banking — ${receipt.receiptNo || receipt.particulars}`,
  };
}
