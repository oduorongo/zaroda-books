import type { Cents } from "./money";

/** RFC 4180: a field is quoted only when it holds a comma, quote or newline. */
const cell = (v: string | number) => {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (rows: (string | number)[][]): string =>
  rows.map((r) => r.map(cell).join(",")).join("\r\n");

/**
 * Cents as a plain decimal with no thousands separator, so the spreadsheet
 * reads it as a number rather than as text. formatKes is for the screen only.
 */
export const csvAmount = (c: Cents): string => (c / 100).toFixed(2);
