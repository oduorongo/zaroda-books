"use client";

import { useActionState } from "react";
import { acceptAction } from "./actions";

export function AcceptForm({ code, orgName, email }: {
  code: string;
  orgName: string;
  email: string;
}) {
  const [error, action, pending] = useActionState(acceptAction, null);

  return (
    <form action={action} className="stack">
      <input type="hidden" name="code" value={code} />
      <p className="note" style={{ margin: 0 }}>
        You are signed in as <strong>{email}</strong>. Joining adds {orgName} to this account.
      </p>
      {error && <p className="error">{error}</p>}
      <button type="submit" className="btn btn-gold" disabled={pending}>
        {pending ? "Joining…" : `Join ${orgName}`}
      </button>
    </form>
  );
}
