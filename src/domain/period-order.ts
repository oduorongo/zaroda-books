/**
 * Months close in order and reopen in reverse. Each month's balance brought
 * down is the one before it carried down (rule 5), so a month closed ahead of
 * an open one would be frozen on figures that can still change.
 */
interface PeriodStatus {
  month: string; // first day, "2024-07-01"
  status: "open" | "closed";
}

const name = (month: string) =>
  new Date(`${month}T00:00:00Z`).toLocaleDateString("en-KE", {
    month: "long", year: "numeric", timeZone: "UTC",
  });

export function closeRefusal(periods: PeriodStatus[], month: string): string | null {
  const sorted = [...periods].sort((a, b) => a.month.localeCompare(b.month));
  const target = sorted.find((p) => p.month === month);
  if (!target) return "That month is not in this book.";
  if (target.status === "closed") return `${name(month)} is already closed.`;
  const earlier = sorted.find((p) => p.month < month && p.status === "open");
  return earlier ? `Close ${name(earlier.month)} first. Months close in order.` : null;
}

export function reopenRefusal(periods: PeriodStatus[], month: string): string | null {
  const sorted = [...periods].sort((a, b) => a.month.localeCompare(b.month));
  const target = sorted.find((p) => p.month === month);
  if (!target) return "That month is not in this book.";
  if (target.status === "open") return `${name(month)} is not closed.`;
  const later = sorted.findLast((p) => p.month > month && p.status === "closed");
  return later ? `Reopen ${name(later.month)} first. Months reopen from the latest.` : null;
}
