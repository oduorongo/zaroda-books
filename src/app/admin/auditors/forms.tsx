"use client";

import { useActionState } from "react";
import { CountyPicker } from "@/app/county-picker";
import { grantAuditorAction, revokeAuditorAction } from "./actions";

export function GrantAuditorForm() {
  const [error, action, pending] = useActionState(grantAuditorAction, null);

  return (
    <form action={action} className="stack" style={{ maxWidth: 620 }}>
      <label className="field">Auditor&apos;s email
        <input name="email" type="email" placeholder="auditor@education.go.ke" required />
        <span className="note">
          They must already have a Zaroda account. Ask them to sign up first — a password is
          theirs to choose, never ours.
        </span>
      </label>

      <CountyPicker />
      <p className="note" style={{ margin: 0 }}>
        Leave the sub-county unchosen to grant the whole county. That is a much wider grant:
        every school in it, whoever keeps the books.
      </p>

      {error && <p className="error">{error}</p>}
      <button type="submit" className="btn btn-gold" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Granting…" : "Grant the audit"}
      </button>
    </form>
  );
}

export function RevokeButton({ auditorId }: { auditorId: string }) {
  const [error, action, pending] = useActionState(revokeAuditorAction, null);
  return (
    <form action={action} style={{ display: "inline" }}>
      <input type="hidden" name="auditorId" value={auditorId} />
      <button type="submit" className="btn-link" style={{ fontSize: ".82rem" }} disabled={pending}>
        {pending ? "Withdrawing…" : "Withdraw"}
      </button>
      {error && <span className="error"> {error}</span>}
    </form>
  );
}
