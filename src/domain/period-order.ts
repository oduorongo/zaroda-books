/**
 * Closing a month closes every open month before it: each month's balance
 * brought down is the one before it carried down (rule 5), so no month may be
 * frozen ahead of an open one. Schools reconcile at the year end rather than
 * monthly, so closing June in one step must close July to June. Reopening
 * opens the whole book again: every closed month of the year, so any entry in
 * it can be corrected before the year is closed afresh.
 */
interface PeriodStatus {
  month: string; // first day, "2024-07-01"
  status: "open" | "closed";
}

type Months = { months: string[]; error?: undefined } | { months?: undefined; error: string };

const name = (month: string) =>
  new Date(`${month}T00:00:00Z`).toLocaleDateString("en-KE", {
    month: "long", year: "numeric", timeZone: "UTC",
  });

const inOrder = (periods: PeriodStatus[]) => [...periods].sort((a, b) => a.month.localeCompare(b.month));

export function monthsToClose(periods: PeriodStatus[], month: string): Months {
  const target = periods.find((p) => p.month === month);
  if (!target) return { error: "That month is not in this book." };
  if (target.status === "closed") return { error: `${name(month)} is already closed.` };
  return {
    months: inOrder(periods).filter((p) => p.month <= month && p.status === "open").map((p) => p.month),
  };
}

/** The year is closed when its last month is: months close in order. */
export const yearClosed = (periods: PeriodStatus[]): boolean =>
  inOrder(periods).at(-1)?.status === "closed";

/** Every closed month of the book, latest first — the order they unwind in. */
export function monthsToReopen(periods: PeriodStatus[], month: string): Months {
  const target = periods.find((p) => p.month === month);
  if (!target) return { error: "That month is not in this book." };
  if (target.status === "open") return { error: `${name(month)} is not closed.` };
  return {
    months: inOrder(periods).filter((p) => p.status === "closed").map((p) => p.month).reverse(),
  };
}
