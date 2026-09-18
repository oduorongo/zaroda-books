/**
 * The financial year runs 1 July to 30 June (CLAUDE.md rule 8), so for the
 * first half of a calendar year the year in progress is the one that opened
 * the previous July. Taking the calendar year would offer a book a year that
 * has not started yet.
 */
export function financialYearInProgress(today: Date = new Date()): number {
  const year = today.getUTCFullYear();
  return today.getUTCMonth() >= 6 ? year : year - 1;
}

/** "2026/27" down to "2022/23", newest first — the order a book is opened in. */
export function financialYearLabels(inProgress: number, earliest: number): string[] {
  const labels: string[] = [];
  for (let y = inProgress; y >= earliest; y -= 1) {
    labels.push(`${y}/${String((y + 1) % 100).padStart(2, "0")}`);
  }
  return labels;
}
