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

/**
 * The year before a label — the one a balance is brought forward from.
 *
 * Null for anything unreadable rather than a guess: a heading that names the
 * wrong year on a set of opening balances is worse than one naming none.
 */
export function previousFinancialYear(label: string): string | null {
  const match = /^(\d{4})\/\d{2}$/.exec(label.trim());
  if (!match) return null;
  const start = Number(match[1]) - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
}

/** The dates an entry form may offer, and the one it opens on. */
export interface EntryDates {
  from: string;
  to: string;
  start: string;
}

/** Today in Kenya. The server runs on UTC, which is yesterday until 3 a.m. */
export const todayInKenya = (now: Date = new Date()): string =>
  now.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });

/**
 * A form opens on today when today is in the book's year. A book for an
 * earlier year opens on its last entry instead — on a phone, the calendar
 * otherwise opens on today and the bursar pages back month by month.
 */
export function entryDates(
  fy: { startsOn: string; endsOn: string },
  posted: string[],
  today: string = todayInKenya(),
): EntryDates {
  const { startsOn: from, endsOn: to } = fy;
  if (today >= from && today <= to) return { from, to, start: today };
  const last = posted.filter((d) => d >= from && d <= to).sort().at(-1);
  return { from, to, start: last ?? from };
}
