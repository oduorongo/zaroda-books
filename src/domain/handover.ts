/**
 * A head of institution handing a school over. The school records it; the
 * auditor's clearance memo starts from it.
 */
export const CLEARANCE_REASONS = ["retirement", "transfer", "promotion", "resignation"] as const;
export type ClearanceReason = (typeof CLEARANCE_REASONS)[number];

export interface Handover {
  officer: string;
  tscNo: string;
  reason: ClearanceReason;
  handoverDate: string;
}

/** Reads what a form sent, or says what is missing. */
export function readHandover(
  officer: string, tscNo: string, reason: string, handoverDate: string,
): Handover | { error: string } {
  if (!officer.trim()) return { error: "Enter the head of institution's name." };
  if (!tscNo.trim()) return { error: "Enter the TSC number." };
  if (!(CLEARANCE_REASONS as readonly string[]).includes(reason)) return { error: "Choose why they are leaving." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(handoverDate)) return { error: "Enter the handover date." };
  return { officer: officer.trim(), tscNo: tscNo.trim(), reason: reason as ClearanceReason, handoverDate };
}

interface MonthStatus { month: string; status: "open" | "closed" }

/**
 * A handover audit covers the outgoing head's books to the end of the month
 * they hand over in: the books close by whole months, and so do the bank's
 * statements. Null when the handover falls outside this book's year.
 */
export function handoverCutoff(handoverDate: string, periods: MonthStatus[]): string | null {
  const month = handoverDate.slice(0, 7);
  return periods.some((p) => p.month.startsWith(month)) ? month : null;
}

/** Months close in order, so every month to the cutoff is closed when the cutoff's is. */
export const closedThrough = (periods: MonthStatus[], cutoff: string): boolean =>
  periods.find((p) => p.month.startsWith(cutoff))?.status === "closed";
