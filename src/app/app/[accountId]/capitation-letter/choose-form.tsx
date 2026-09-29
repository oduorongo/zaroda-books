"use client";

import { useState } from "react";
import { TERMS, formatKes, termRoman, type Term } from "@/domain";

export interface LetterReceipt {
  id: string;
  date: string;
  particulars: string;
  receiptNo?: string;
  amount: number;
  /** The term and year the receipt is read as, or null for one that is not capitation. See receiptTerm. */
  term: Term | null;
  year: number | null;
}

export interface LetterBook {
  id: string;
  name: string;
  fyLabel: string;
  receipts: LetterReceipt[];
}

/**
 * Choosing the term and year ticks the receipts of that term across all the
 * school's capitation books; the rest are folded away, to tick by hand if one
 * was read wrongly. Unticking is always possible.
 */
export function ChooseLetterForm({ books, initial, invalid }: {
  books: LetterBook[];
  initial: { term: string; year: string; date: string; ticked: string[] };
  invalid: boolean;
}) {
  const matching = (term: string, year: string) => new Set(
    books.flatMap((b) => b.receipts)
      .filter((r) => term && r.term === Number(term) && r.year === Number(year))
      .map((r) => r.id),
  );
  const [term, setTerm] = useState(initial.term);
  const [year, setYear] = useState(initial.year);
  const [ticked, setTicked] = useState<Set<string>>(
    () => initial.ticked.length ? new Set(initial.ticked) : matching(initial.term, initial.year),
  );
  const matched = matching(term, year);

  const choose = (t: string, y: string) => {
    setTerm(t);
    setYear(y);
    setTicked(matching(t, y));
  };
  const toggle = (id: string) => {
    const next = new Set(ticked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setTicked(next);
  };

  const row = (r: LetterReceipt) => (
    <label key={r.id} style={{ display: "flex", gap: ".6rem", alignItems: "baseline", padding: ".3rem 0" }}>
      <input type="checkbox" name="r" value={r.id} checked={ticked.has(r.id)} onChange={() => toggle(r.id)} />
      <span style={{ flex: 1 }}>
        {r.date} · {r.particulars}{r.receiptNo ? ` · ${r.receiptNo}` : ""}
      </span>
      <span className="mono">{formatKes(r.amount)}</span>
    </label>
  );
  const total = books.flatMap((b) => b.receipts).filter((r) => ticked.has(r.id)).reduce((s, r) => s + r.amount, 0);
  const label = term ? `Term ${termRoman(Number(term) as Term)} ${year}` : "";

  return (
    <form method="get" className="card stack" style={{ marginBottom: "1.35rem" }}>
      <div className="grid-2">
        <label className="field">Term
          <select name="term" value={term} onChange={(e) => choose(e.target.value, year)} required>
            <option value="" disabled>Choose…</option>
            {TERMS.map((t) => <option key={t} value={t}>Term {termRoman(t)}</option>)}
          </select>
        </label>
        <label className="field">Year
          <input name="year" type="number" min={2000} max={2100} value={year}
            onChange={(e) => choose(term, e.target.value)} required />
        </label>
        <label className="field">Date of the letter
          <input name="date" type="date" defaultValue={initial.date} required />
        </label>
      </div>

      {!term ? (
        <p className="note">Choose the term and year: the receipts for it are ticked for you.</p>
      ) : (
        <p className="note">
          {matched.size
            ? `${matched.size} receipt${matched.size === 1 ? "" : "s"} for ${label} ticked — ${formatKes(total)} in all. Untick any that do not belong.`
            : `No receipt reads as ${label}. Tick the right ones under "Other receipts", or check the term and year.`}
        </p>
      )}

      {books.map((b) => {
        const mine = b.receipts.filter((r) => matched.has(r.id));
        const others = b.receipts.filter((r) => !matched.has(r.id));
        if (term && !mine.length && !others.some((r) => ticked.has(r.id)) && !b.receipts.length) return null;
        return (
          <fieldset key={b.id} style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="eyebrow">{b.name} · FY {b.fyLabel}</legend>
            {b.receipts.length === 0 && <p className="note">No receipts posted in this book.</p>}
            {term && b.receipts.length > 0 && mine.length === 0 && <p className="note">Nothing for {label} in this book.</p>}
            {mine.map(row)}
            {others.length > 0 && (
              <details open={!term || others.some((r) => ticked.has(r.id))}>
                <summary className="note" style={{ cursor: "pointer" }}>
                  {term ? `Other receipts in this book (${others.length})` : `Receipts in this book (${others.length})`}
                </summary>
                {others.map(row)}
              </details>
            )}
          </fieldset>
        );
      })}

      <button type="submit" className="btn btn-primary" disabled={!ticked.size}>Prepare letter</button>
      {invalid && <p className="error">Choose the term, the year, the date and at least one receipt.</p>}
    </form>
  );
}
