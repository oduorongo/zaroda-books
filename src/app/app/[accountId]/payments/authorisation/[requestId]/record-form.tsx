"use client";

import { useActionState } from "react";
import { DecisionTable, type DecisionRow } from "../../../../../decision-table";
import { recordScheduleAction } from "../../actions";

/** The bookkeeper recording what the head signed: untick any the head struck out, with the head's reason. */
export function RecordScheduleForm({ accountId, requestId, rows }: {
  accountId: string; requestId: string; rows: DecisionRow[];
}) {
  const [error, action, pending] = useActionState(recordScheduleAction, null);
  return (
    <form action={action} className="card no-print" style={{ marginTop: "1.6rem" }}>
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="requestId" value={requestId} />
      <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Record the signed schedule</h2>
      <p className="note">
        Once the head has signed, enter the date on the signature. Untick any payment the head struck out
        and write the head&apos;s reason. Keep the signed paper in the voucher file: the auditor asks for it.
      </p>
      <DecisionTable rows={rows} />
      <label className="field" style={{ maxWidth: 260, marginTop: "1rem" }}>Date the head signed
        <input name="signedOn" type="date" required />
      </label>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Recording…" : "Record as signed"}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
