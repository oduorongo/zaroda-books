"use client";

import { useActionState } from "react";
import { CLEARANCE_REASONS } from "@/domain";
import { saveHandoverAction } from "./actions";

/** The head of institution handing over, for the auditor's clearance memo. */
export function HandoverForm({ accountId, current }: {
  accountId: string;
  current: { officer: string; tscNo: string; reason: string; handoverDate: string } | null;
}) {
  const [message, action, pending] = useActionState(saveHandoverAction, null);

  return (
    <form action={action} className="card" style={{ maxWidth: 720, marginBottom: "1.6rem" }}>
      <input type="hidden" name="accountId" value={accountId} />
      <p className="note" style={{ marginTop: 0 }}>
        When a head of institution is leaving and needs an audit clearance letter, record them here.
        The auditor&apos;s clearance memo starts from these details.
      </p>
      <div className="grid-2">
        <label className="field">Head of institution
          <input name="officer" defaultValue={current?.officer} required />
        </label>
        <label className="field">TSC number
          <input name="tscNo" defaultValue={current?.tscNo} required />
        </label>
        <label className="field">Leaving on
          <select name="reason" defaultValue={current?.reason ?? "retirement"}>
            {CLEARANCE_REASONS.map((r) => (
              <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>
            ))}
          </select>
        </label>
        <label className="field">Handover date
          <input name="handoverDate" type="date" defaultValue={current?.handoverDate} required />
        </label>
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </button>
      {message && <p className={message === "Saved." ? "verdict ok" : "error"}>{message}</p>}
    </form>
  );
}
