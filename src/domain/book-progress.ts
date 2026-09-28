/**
 * Where a book stands on its way to audit: evidence, the head's approval,
 * closing, sending, taking back and the auditor's report. Worked out from
 * what the book already records, never stored, so it cannot drift from it.
 */

export type BookStageKey =
  | "not-started" | "writing" | "closing" | "reopened" | "closed" | "sent" | "handover" | "audited";

export interface BookStageFacts {
  entries: number;
  months: { month: string; status: "open" | "closed" }[]; // month: "2025-07-01"
  /** The latest close or reopen of any month of the book. */
  lastPeriodEvent: "close" | "reopen" | null;
  /** Null while no auditor has the book. `upTo` is "yyyy-mm" for a handover audit. */
  sent: { upTo: string | null } | null;
  /** An issued report covers this book, issued since it was last sent. */
  auditedSinceSent: boolean;
}

const monthLabel = (month: string) =>
  new Date(`${month.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString("en-KE", {
    month: "long", year: "numeric", timeZone: "UTC",
  });

export function bookStage(f: BookStageFacts): { key: BookStageKey; label: string } {
  const months = [...f.months].sort((a, b) => a.month.localeCompare(b.month));
  if (f.sent) {
    if (f.auditedSinceSent) return { key: "audited", label: "Audited" };
    return f.sent.upTo
      ? { key: "handover", label: `With the auditor — handover, to ${monthLabel(f.sent.upTo)}` }
      : { key: "sent", label: "With the auditor" };
  }
  if (months.at(-1)?.status === "closed") return { key: "closed", label: "Year closed — not yet sent for audit" };
  if (f.lastPeriodEvent === "reopen") return { key: "reopened", label: "Reopened — to be closed again" };
  const lastClosed = months.filter((m) => m.status === "closed").at(-1);
  if (lastClosed) return { key: "closing", label: `Closed to ${monthLabel(lastClosed.month)}` };
  if (f.entries > 0) return { key: "writing", label: "Being written up" };
  return { key: "not-started", label: "Not started" };
}

export interface ReportCover {
  kind: "ipsas" | "primary" | "clearance";
  accountId: string | null;
  years: string | null; // JSON, e.g. ["2024/25","2025/26"]
  periodFrom: string | null;
  periodTo: string | null;
}

/**
 * Whether an issued report is on this book's year. A primary report names
 * its account; an IPSAS report its years; a clearance memo the date the
 * outgoing head's period ends, which falls in one book year.
 */
export function reportCoversBook(
  r: ReportCover, book: { accountId: string; fyLabel: string; startsOn: string; endsOn: string },
): boolean {
  if (r.kind === "primary") {
    return r.accountId === book.accountId && !!r.periodFrom && !!r.periodTo
      && r.periodFrom <= book.endsOn && r.periodTo >= book.startsOn;
  }
  if (r.kind === "ipsas") {
    try {
      return (JSON.parse(r.years ?? "[]") as string[]).includes(book.fyLabel);
    } catch {
      return false;
    }
  }
  return !!r.periodTo && r.periodTo >= book.startsOn && r.periodTo <= book.endsOn;
}

export type StepState = "done" | "doing" | "todo";
export const STEP_LABEL: Record<StepState, string> = { done: "Done", doing: "In progress", todo: "Not started" };
