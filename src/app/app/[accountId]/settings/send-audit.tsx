"use client";

import { useActionState } from "react";
import { sendForAuditAction } from "./actions";

export function SendForAudit({ accountId, auditors, sentTo, handoverTo }: {
  accountId: string;
  auditors: { grantId: string; label: string }[];
  sentTo: string | null;
  /** Set for a handover audit: the last month it covers, by name. */
  handoverTo?: string;
}) {
  const [error, action, pending] = useActionState(sendForAuditAction, null);

  return (
    <form action={action} style={{ display: "flex", gap: ".75rem", alignItems: "end", flexWrap: "wrap", marginTop: "1rem" }}
      onSubmit={(e) => {
        const what = handoverTo ? `the months up to ${handoverTo}, for a handover audit,` : "this closed year";
        if (!confirm(`Send ${what} to the chosen auditor? They will be able to read the book and raise queries.`)) e.preventDefault();
      }}>
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="scope" value={handoverTo ? "handover" : "year"} />
      <label className="field" style={{ margin: 0, flex: "1 1 18rem" }}>{sentTo ? "Send to a different auditor" : "Auditor"}
        <select name="grantId" required defaultValue="">
          <option value="" disabled>Choose the auditor…</option>
          {auditors.map((a) => <option key={a.grantId} value={a.grantId}>{a.label}</option>)}
        </select>
      </label>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Sending…" : handoverTo ? `Send handover audit, up to ${handoverTo}` : "Send for audit"}
      </button>
      {error && <p className="error" style={{ flexBasis: "100%" }}>{error}</p>}
    </form>
  );
}
