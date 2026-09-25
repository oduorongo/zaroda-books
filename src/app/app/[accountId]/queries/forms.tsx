"use client";

import { useActionState, useEffect, useRef } from "react";
import { closeAction, raiseQueryAction, replyAction } from "./actions";

export function RaiseQuery({ accountId, transactionId, subject }: {
  accountId: string;
  transactionId?: string;
  subject: string;
}) {
  const [message, action, pending] = useActionState(raiseQueryAction, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (message === "Raised.") form.current?.reset(); }, [message]);

  return (
    <form ref={form} action={action} className="card no-print" style={{ marginBottom: "1.6rem" }}>
      <input type="hidden" name="accountId" value={accountId} />
      {transactionId && <input type="hidden" name="transactionId" value={transactionId} />}
      <div className="eyebrow">Raise a query</div>
      <p style={{ margin: ".5rem 0 1rem", fontWeight: 500 }}>{subject}</p>
      <label className="field">Query
        <textarea name="body" rows={3} required
          placeholder="e.g. No supporting invoice for this payment. Provide it or explain." />
      </label>
      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginTop: "1rem" }}>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Raising…" : "Raise query"}
        </button>
        <span className="note">The school&apos;s owner is emailed.</span>
      </div>
      {message && <p className={message === "Raised." ? "note" : "error"}>{message}</p>}
    </form>
  );
}

export function Reply({ accountId, queryId, asAuditor }: { accountId: string; queryId: string; asAuditor: boolean }) {
  const [message, action, pending] = useActionState(replyAction, null);
  const [closeError, close, closing] = useActionState(closeAction, null);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (message === "Sent.") form.current?.reset(); }, [message]);

  return (
    <div className="no-print" style={{ marginTop: "1rem" }}>
      <form ref={form} action={action}>
        <input type="hidden" name="accountId" value={accountId} />
        <input type="hidden" name="queryId" value={queryId} />
        <label className="field">{asAuditor ? "Reply to the school" : "Your answer"}
          <textarea name="body" rows={2} required
            placeholder={asAuditor
              ? "e.g. The invoice sent does not match the amount paid."
              : "e.g. Invoice attached to the voucher; the amount was corrected by amendment."} />
        </label>
        <button type="submit" className="btn" disabled={pending} style={{ marginTop: ".6rem" }}>
          {pending ? "Sending…" : asAuditor ? "Send back to the school" : "Send answer"}
        </button>
        {message && message !== "Sent." && <p className="error">{message}</p>}
      </form>
      {asAuditor && (
        <form action={close} style={{ marginTop: ".6rem" }}
          onSubmit={(e) => { if (!confirm("Close this query as settled? Nothing more can be added to it.")) e.preventDefault(); }}>
          <input type="hidden" name="accountId" value={accountId} />
          <input type="hidden" name="queryId" value={queryId} />
          <button type="submit" className="btn btn-primary" disabled={closing}>
            {closing ? "Closing…" : "Close query — settled"}
          </button>
          {closeError && <p className="error">{closeError}</p>}
        </form>
      )}
    </div>
  );
}
