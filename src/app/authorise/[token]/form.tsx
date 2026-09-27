"use client";

import { useActionState } from "react";
import { DecisionTable, type DecisionRow } from "../../decision-table";
import { decideAction, emailCodeAction } from "./actions";

export function AuthoriseForm({ token, rows, sentTo }: { token: string; rows: DecisionRow[]; sentTo: string }) {
  const [codeMessage, askCode, asking] = useActionState(emailCodeAction, null);
  const [state, decide, saving] = useActionState(decideAction, null);

  if (state?.done) {
    return (
      <div className="card">
        <p className="verdict ok" style={{ marginTop: 0 }}>
          Done. {state.done.authorised} payment{state.done.authorised === 1 ? "" : "s"} authorised
          {state.done.held ? `, ${state.done.held} held back` : ""}.
        </p>
        <p className="note" style={{ marginBottom: 0 }}>
          The vouchers now carry your authorisation. Payments you left unticked without a reason go to you again next time.
        </p>
      </div>
    );
  }

  return (
    <>
      <form action={decide} id="decide" className="card" style={{ marginBottom: "1.35rem" }}>
        <input type="hidden" name="token" value={token} />
        <DecisionTable rows={rows} />
      </form>

      <div className="card">
        <p style={{ marginTop: 0 }}>
          <strong>1.</strong> Ask for a code. It goes to {sentTo} and works for fifteen minutes.
        </p>
        <form action={askCode}>
          <input type="hidden" name="token" value={token} />
          <button type="submit" className="btn btn-quiet" disabled={asking}>
            {asking ? "Sending…" : "Email me a code"}
          </button>
          {codeMessage && <p className={codeMessage.startsWith("Sent.") ? "verdict ok" : "error"}>{codeMessage}</p>}
        </form>

        <p style={{ margin: "1.5rem 0 .5rem" }}>
          <strong>2.</strong> Enter the code to authorise the ticked payments and hold back any with a reason.
        </p>
        <div style={{ display: "flex", gap: ".75rem", alignItems: "center", flexWrap: "wrap" }}>
          <input
            form="decide" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
            placeholder="6-digit code" required style={{ width: "10rem" }}
          />
          <button form="decide" type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Authorise"}
          </button>
        </div>
        {state?.error && <p className="error">{state.error}</p>}
      </div>
    </>
  );
}
