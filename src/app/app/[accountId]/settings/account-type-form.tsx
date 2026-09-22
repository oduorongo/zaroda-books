"use client";

import { useActionState } from "react";
import type { AccountType } from "@/domain";
import { changeAccountTypeAction } from "./actions";

export function AccountTypeForm({
  accountId, current, options, entries,
}: {
  accountId: string;
  current: AccountType;
  /** Every type this school's level offers, whether or not it is in use. */
  options: { id: AccountType; label: string }[];
  /** Posted entries. The type cannot move once the book has any. */
  entries: number;
}) {
  const [message, action, pending] = useActionState(changeAccountTypeAction, null);
  const locked = entries > 0;

  return (
    <form action={action} className="card" style={{ maxWidth: 720 }}>
      <input type="hidden" name="accountId" value={accountId} />

      <div style={{ display: "flex", gap: "1.25rem", alignItems: "end", flexWrap: "wrap" }}>
        <label className="field" style={{ margin: 0 }}>Account type
          <select name="accountType" defaultValue={current} disabled={locked}>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
        <button type="submit" className="btn btn-primary" disabled={pending || locked}>
          {pending ? "Saving…" : "Change the type"}
        </button>
      </div>

      {locked ? (
        <p className="note" style={{ marginTop: "1rem" }}>
          This book has {entries} entr{entries === 1 ? "y" : "ies"} posted. The account type
          fixes which vote heads exist, and a posted entry names one of them, so the type cannot
          move while entries sit in it. Remove them from{" "}
          <a href={`/app/${accountId}/receipts`}>Receipts</a> and{" "}
          <a href={`/app/${accountId}/payments`}>Payments</a> — each has an Amend link with a
          delete — and this will unlock.
        </p>
      ) : (
        <p className="note" style={{ marginTop: "1rem" }}>
          The book is empty, so the type can still be corrected. Its vote heads are rebuilt from
          the chart for the new type, with the rates from the circular. Choosing a type this
          school already keeps a book under is refused — archive the other one first if this
          should replace it.
        </p>
      )}

      {message && (
        <p className={message.startsWith("Saved") ? "verdict ok" : "error"}>{message}</p>
      )}
    </form>
  );
}
