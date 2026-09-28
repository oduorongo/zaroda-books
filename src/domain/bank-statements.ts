/**
 * The bank's own statements, attached so the auditor can set them beside
 * the balance the school typed. One file may cover a single month or the
 * whole year, as the bank issued it; what matters is that every month of
 * the book is covered. Months are "yyyy-mm".
 */

export interface Coverage { from: string; to: string }

export function uncoveredMonths(months: string[], statements: Coverage[]): string[] {
  return months.filter((m) => !statements.some((s) => s.from <= m && m <= s.to));
}

export function statementCoverageProblem(from: string, to: string, months: string[]): string | null {
  if (!months.includes(from) || !months.includes(to)) return "Choose months within this book's financial year.";
  if (to < from) return "The last month the statement covers cannot be before the first.";
  return null;
}

/** Why the book cannot go for audit, from the names of the months with no statement. */
export function statementsAuditBlock(missing: string[]): string | null {
  if (!missing.length) return null;
  return `No bank statement is attached for ${missing.join(", ")}. Attach them on the bank reconciliation.`;
}

/**
 * Which uncovered months stop the audit. Only the year-end statement is
 * required, since it proves the closing balance the whole audit rests on;
 * the rest are asked for, never insisted on. A handover audit requires none.
 */
export function statementGaps(missing: string[], lastMonth: string, handover: boolean) {
  const required = handover ? [] : missing.filter((m) => m === lastMonth);
  return { required, optional: missing.filter((m) => !required.includes(m)) };
}
