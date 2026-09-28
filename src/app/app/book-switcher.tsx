"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { LEVEL_LABEL, type SchoolLevel } from "@/domain";

export interface SwitcherBook {
  accountId: string;
  schoolId: string;
  school: string;
  level: SchoolLevel;
  account: string;
  fyLabel: string;
}

/**
 * School, then year, then the book. Each school keeps a book per account per
 * year, so one list of them all grows too long to read; the filters start on
 * the open book's school and year.
 */
export function BookSwitcher({ books }: { books: SwitcherBook[] }) {
  const router = useRouter();
  const { accountId } = useParams<{ accountId?: string }>();
  const current = books.find((b) => b.accountId === accountId);
  const [schoolId, setSchoolId] = useState(current?.schoolId ?? "");
  const [year, setYear] = useState(current?.fyLabel ?? "");
  // The sidebar stays mounted between books, so a book opened from elsewhere
  // brings the filters round to it.
  const [shownFor, setShownFor] = useState(accountId);
  if (accountId !== shownFor) {
    setShownFor(accountId);
    if (current) {
      setSchoolId(current.schoolId);
      setYear(current.fyLabel);
    }
  }

  if (!books.length) return <div style={{ fontSize: ".85rem" }}>No books yet.</div>;

  const schools = [...new Map(books.map((b) => [b.schoolId, b])).values()];
  const ofSchool = books.filter((b) => !schoolId || b.schoolId === schoolId);
  const years = [...new Set(ofSchool.map((b) => b.fyLabel).filter(Boolean))].sort().reverse();
  const shown = ofSchool.filter((b) => !year || b.fyLabel === year);
  const selected = shown.some((b) => b.accountId === accountId) ? accountId! : "";

  return (
    <div style={{ display: "grid", gap: ".5rem" }}>
      <select value={schoolId} aria-label="School"
        onChange={(e) => {
          setSchoolId(e.target.value);
          // Keep the year if the new school has a book in it.
          if (!books.some((b) => b.schoolId === e.target.value && b.fyLabel === year)) setYear("");
        }}>
        <option value="">All schools</option>
        {schools.map((s) => (
          <option key={s.schoolId} value={s.schoolId}>{s.school} · {LEVEL_LABEL[s.level]}</option>
        ))}
      </select>
      <select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Financial year">
        <option value="">All years</option>
        {years.map((y) => <option key={y} value={y}>FY {y}</option>)}
      </select>
      <select
        value={selected}
        onChange={(e) => router.push(`/app/${e.target.value}/progress`)}
        aria-label="Book"
      >
        {/* Nothing is open until a book is chosen: opening the first one on the
            list put receipts into whichever school sorted first. */}
        {!selected && <option value="" disabled>Choose a book…</option>}
        {shown.map((b) => (
          <option key={b.accountId} value={b.accountId}>
            {schoolId ? "" : `${b.school} — `}{b.account}{year ? "" : ` ${b.fyLabel}`}
          </option>
        ))}
      </select>
    </div>
  );
}
