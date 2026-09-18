"use client";

import { useActionState } from "react";
import { saveStatement } from "./actions";

export function StatementForm({
  accountId, periodId, statementBank, statementDate,
}: {
  accountId: string;
  periodId: string;
  statementBank: string;
  statementDate: string;
}) {
  const [error, action, pending] = useActionState(saveStatement, null);

  return (
    <form action={action} className="card no-print">
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="periodId" value={periodId} />
      <div style={{ display: "flex", gap: "1.25rem", alignItems: "end", flexWrap: "wrap" }}>
        <label className="field" style={{ margin: 0 }}>Closing balance per bank statement (KES)
          <input name="statementBank" className="mono" inputMode="decimal" placeholder="0"
            defaultValue={statementBank} required />
        </label>
        <label className="field" style={{ margin: 0 }}>Statement date
          <input name="statementDate" type="date" defaultValue={statementDate} />
        </label>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <p className="note" style={{ marginTop: "1rem" }}>
        Copy this from the statement the bank sent. It is never worked out from the book — that is
        what makes it proof.
      </p>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
