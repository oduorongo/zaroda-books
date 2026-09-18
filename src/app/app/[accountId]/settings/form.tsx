"use client";

import { useActionState } from "react";
import { changeFinancialYearAction } from "./actions";

export function FinancialYearForm({
  accountId, current, years, entries,
}: {
  accountId: string;
  current: string;
  years: string[];
  /** Posted entries. The year cannot move once the book has any. */
  entries: number;
}) {
  const [message, action, pending] = useActionState(changeFinancialYearAction, null);
  const locked = entries > 0;

  return (
    <form action={action} className="card" style={{ maxWidth: 720 }}>
      <input type="hidden" name="accountId" value={accountId} />

      <div style={{ display: "flex", gap: "1.25rem", alignItems: "end", flexWrap: "wrap" }}>
        <label className="field" style={{ margin: 0 }}>Financial year
          <select name="fyLabel" defaultValue={current} disabled={locked}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <button type="submit" className="btn btn-primary" disabled={pending || locked}>
          {pending ? "Saving…" : "Change the year"}
        </button>
      </div>

      {locked ? (
        <p className="note" style={{ marginTop: "1rem" }}>
          This book has {entries} entr{entries === 1 ? "y" : "ies"} posted. The financial year
          decides which months exist, and an entry can only be dated inside its own year, so the
          year cannot move while entries sit in it. Remove them from{" "}
          <a href={`/app/${accountId}/receipts`}>Receipts</a> and{" "}
          <a href={`/app/${accountId}/payments`}>Payments</a> — each has an Amend link with a
          delete — and this will unlock.
        </p>
      ) : (
        <p className="note" style={{ marginTop: "1rem" }}>
          The book is empty, so the year can still be corrected. The twelve months are rebuilt from
          1 July to 30 June. Vote heads, the rates from the circular and the opening balances are
          all kept.
        </p>
      )}

      {message && (
        <p className={message.startsWith("Saved") ? "verdict ok" : "error"}>{message}</p>
      )}
    </form>
  );
}
