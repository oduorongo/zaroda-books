import type { Cents } from "./money";

/**
 * Reads an amount a person typed, into cents.
 *
 * One parser, used by the form and by the server. They used to differ: the
 * form stripped anything that was not a digit or a dot, while the server
 * called Number(). So "3,500" — the way the figure is written — showed a
 * sensible total on screen and was then refused on save, with no way to tell
 * from the message what was wrong with it.
 *
 * Three outcomes, and they are not the same thing:
 *   a number  — the amount in cents
 *   null      — the box is empty, so there is no line for this vote head
 *   undefined — it was typed but cannot be read, which is an error to show
 */
export function parseAmount(raw: string): Cents | null | undefined {
  const text = raw.trim();
  if (text === "") return null;

  // Commas, spaces and a currency mark are how the figure is written, not
  // mistakes. A minus sign is not stripped: it means something, and a
  // payment cannot be negative.
  const cleaned = text
    .replace(/^KSh\.?/i, "")
    .replace(/\/=$/, "")
    .replace(/[,\s]/g, "")
    .replace(/[A-Za-z]+$/, "")
    .trim();

  if (!/^\d+(\.\d+)?$/.test(cleaned)) return undefined;

  const n = Number(cleaned);
  if (!Number.isFinite(n)) return undefined;
  return Math.round(n * 100);
}
