"use client";

import { useActionState } from "react";
import { addVoteHeadAction } from "./actions";

export function AddVoteHeadForm({ accountId }: { accountId: string }) {
  const [error, action, pending] = useActionState(addVoteHeadAction, null);

  return (
    <form action={action} className="card" style={{ maxWidth: 820 }}>
      <input type="hidden" name="accountId" value={accountId} />
      <div className="field-row narrow-first">
        <label className="field">Code
          <input name="code" className="mono" placeholder="SEC" maxLength={6} required
            style={{ textTransform: "uppercase" }} />
        </label>
        <label className="field">Name
          <input name="name" placeholder="Security and watchman services" required />
        </label>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      {error && <p className="error" style={{ marginTop: "1rem" }}>{error}</p>}
      <p className="note" style={{ marginTop: "1rem" }}>
        A head you add carries no capitation rate. Payments can be charged to it, and it will
        receive money only if you allocate some to it on a receipt.
      </p>
    </form>
  );
}
