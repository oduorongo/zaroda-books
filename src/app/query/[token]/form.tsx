"use client";

import { useActionState } from "react";
import { answerAction, queryCodeAction } from "./actions";

export function AnswerForm({ token, sentTo }: { token: string; sentTo: string }) {
  const [codeMessage, askCode, asking] = useActionState(queryCodeAction, null);
  const [message, answer, sending] = useActionState(answerAction, null);

  if (message === "Sent.") {
    return (
      <div className="card">
        <p className="verdict ok" style={{ marginTop: 0 }}>Your answer has gone to the auditor.</p>
        <p className="note" style={{ marginBottom: 0 }}>If the auditor replies, you will be emailed again.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <p style={{ marginTop: 0 }}><strong>1.</strong> Ask for a code. It goes to {sentTo} and works for fifteen minutes.</p>
      <form action={askCode}>
        <input type="hidden" name="token" value={token} />
        <button type="submit" className="btn btn-quiet" disabled={asking}>{asking ? "Sending…" : "Email me a code"}</button>
        {codeMessage && <p className={codeMessage.startsWith("Sent.") ? "verdict ok" : "error"}>{codeMessage}</p>}
      </form>

      <form action={answer} style={{ marginTop: "1.5rem" }}>
        <input type="hidden" name="token" value={token} />
        <p style={{ margin: "0 0 .5rem" }}><strong>2.</strong> Write your answer and enter the code.</p>
        <label className="field">Your answer, as head of institution
          <textarea name="body" rows={4} required />
        </label>
        <div style={{ display: "flex", gap: ".75rem", alignItems: "center", flexWrap: "wrap", marginTop: ".75rem" }}>
          <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
            placeholder="6-digit code" required style={{ width: "10rem" }} />
          <button type="submit" className="btn btn-primary" disabled={sending}>{sending ? "Sending…" : "Send answer"}</button>
        </div>
        {message && <p className="error">{message}</p>}
      </form>
    </div>
  );
}
