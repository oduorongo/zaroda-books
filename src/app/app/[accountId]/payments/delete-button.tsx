"use client";

import { useActionState } from "react";
import { deletePayment } from "./actions";

export function DeletePayment({
  accountId, transactionId,
}: {
  accountId: string;
  transactionId: string;
}) {
  const [error, action, pending] = useActionState(deletePayment, null);

  return (
    <form
      action={action}
      style={{ marginTop: "1.6rem" }}
      onSubmit={(e) => {
        if (!confirm("Delete this payment? This cannot be undone.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="transactionId" value={transactionId} />
      <button type="submit" className="btn" disabled={pending} style={{ color: "var(--alarm)" }}>
        {pending ? "Deleting…" : "Delete this payment"}
      </button>
      <span className="note" style={{ marginLeft: "1rem" }}>
        The books normally reverse an entry rather than remove it. Deleting is for a payment posted
        in error; the deletion itself is written to the audit log.
      </span>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
