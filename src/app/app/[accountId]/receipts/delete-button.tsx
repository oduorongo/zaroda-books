"use client";

import { useActionState } from "react";
import { deleteReceipt } from "./actions";

export function DeleteReceipt({
  accountId, transactionId,
}: {
  accountId: string;
  transactionId: string;
}) {
  const [error, action, pending] = useActionState(deleteReceipt, null);

  return (
    <form
      action={action}
      style={{ marginTop: "1.6rem" }}
      onSubmit={(e) => {
        if (!confirm("Delete this receipt? The acknowledgement goes with it. This cannot be undone."))
          e.preventDefault();
      }}
    >
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="transactionId" value={transactionId} />
      <button type="submit" className="btn" disabled={pending} style={{ color: "var(--alarm)" }}>
        {pending ? "Deleting…" : "Delete this receipt"}
      </button>
      <span className="note" style={{ marginLeft: "1rem" }}>
        The acknowledgement goes with it, so do not delete one already returned to the Ministry —
        amend it instead. The deletion is written to the audit log.
      </span>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
