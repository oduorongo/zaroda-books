"use client";

import Link from "next/link";
import { useState } from "react";
import { LEVEL_LABEL, type SchoolLevel } from "@/domain";
import { LEVEL_MARK } from "./[accountId]/level-mark";

interface Book {
  accountId: string;
  school: string;
  level: SchoolLevel;
  account: string;
  fyLabel: string;
}

export function BookChooser({ books }: { books: Book[] }) {
  const [query, setQuery] = useState("");
  const shown = books.filter((b) => b.school.toLowerCase().includes(query.trim().toLowerCase()));

  // Grouped by school, in the order the query returned them: school, account,
  // newest year first. A school is its name and level, as everywhere else.
  const schools = [...new Set(shown.map((b) => `${b.school}|${b.level}`))];

  return (
    <>
      {books.length > 5 && (
        <label className="field" style={{ marginBottom: "1.25rem" }}>Find a school
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type part of the name" autoFocus />
        </label>
      )}

      {schools.length === 0 && <p className="note">No school matches “{query}”.</p>}

      {schools.map((key) => {
        const rows = shown.filter((b) => `${b.school}|${b.level}` === key);
        const { school, level } = rows[0];
        return (
          <div key={key} className={`card level-card level-${level}`} style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: ".75rem", marginBottom: ".6rem" }}>
              <span className={`level-band level-${level}`} style={{ margin: 0 }}>
                <span className="level-letter"><span>{LEVEL_MARK[level].letter}</span></span>
              </span>
              <div>
                <div style={{ fontWeight: 600 }}>{school}</div>
                <div className="note">{LEVEL_LABEL[level]}</div>
              </div>
            </div>
            <table>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.accountId}>
                    <td>
                      <Link href={`/app/${b.accountId}/receipts`} style={{ fontWeight: 500 }}>{b.account}</Link>
                    </td>
                    <td className="n mono">FY {b.fyLabel || "—"}</td>
                    <td className="n"><Link href={`/app/${b.accountId}/receipts`}>Open →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}
