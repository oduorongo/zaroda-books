"use client";

import Link from "next/link";
import { useActionState } from "react";
import { closeMonthAction, reopenMonthAction } from "./actions";

export function CloseMonth({
  accountId, month, monthName, closed, reconciled, closes, reopens, canClose, canReopen, nextYear,
}: {
  accountId: string;
  month: string;
  monthName: string;
  closed: boolean;
  reconciled: boolean;
  /** Every month a close takes with it, earliest first — the months still open before this one. */
  closes: string[];
  /** Every month a reopen takes with it, latest first. */
  reopens: string[];
  canClose: boolean;
  canReopen: boolean;
  /** Set on June once it is closed: where the next year's book is, or how to open it. */
  nextYear: { label: string; href: string; exists: boolean } | null;
}) {
  const [closeError, close, closing] = useActionState(closeMonthAction, null);
  const [reopenError, reopen, reopening] = useActionState(reopenMonthAction, null);

  const span = closes.length > 1 ? `${closes[0]} to ${closes[closes.length - 1]}` : monthName;

  if (!closed) {
    if (!reconciled || !canClose) return null;
    return (
      <form action={close} className="no-print" style={{ marginTop: "1rem" }}
        onSubmit={(e) => {
          if (!confirm(`Close ${span}? Nothing dated in ${closes.length > 1 ? "them" : "it"} can be posted, amended or deleted until reopened.`))
            e.preventDefault();
        }}>
        <input type="hidden" name="accountId" value={accountId} />
        <input type="hidden" name="month" value={month} />
        <button type="submit" className="btn btn-primary" disabled={closing}>
          {closing ? "Closing…" : `Close ${monthName}`}
        </button>
        {closes.length > 1 && (
          <span className="note" style={{ marginLeft: "1rem" }}>
            Also closes the {closes.length - 1} open month{closes.length > 2 ? "s" : ""} before it, from {closes[0]}.
          </span>
        )}
        {closeError && <p className="error">{closeError}</p>}
      </form>
    );
  }

  return (
    <div className="no-print" style={{ marginTop: "1rem" }}>
      <p className="verdict ok" style={{ marginTop: 0 }}>{monthName} is closed.</p>

      {nextYear && (
        <p style={{ margin: ".5rem 0 1rem" }}>
          {nextYear.exists
            ? <Link href={nextYear.href}>Go to the {nextYear.label} book →</Link>
            : <Link className="btn btn-primary" href={nextYear.href}>Start {nextYear.label} →</Link>}
          {!nextYear.exists && (
            <span className="note" style={{ display: "block", marginTop: ".4rem" }}>
              The new book opens with this year&apos;s closing cash and bank as its opening balances.
            </span>
          )}
        </p>
      )}

      {canReopen && (
        <form action={reopen} style={{ display: "flex", gap: ".75rem", alignItems: "end", flexWrap: "wrap" }}>
          <input type="hidden" name="accountId" value={accountId} />
          <input type="hidden" name="month" value={month} />
          <label className="field" style={{ margin: 0, flex: "1 1 18rem" }}>Reason for reopening
            <input name="reason" placeholder="e.g. bank charges for June not posted" required />
          </label>
          <button type="submit" className="btn" disabled={reopening}>
            {reopening ? "Reopening…" : `Reopen ${monthName}`}
          </button>
          {reopens.length > 1 && (
            <span className="note" style={{ flexBasis: "100%" }}>
              Also reopens {reopens.slice(0, -1).reverse().join(", ")}, closed after it.
            </span>
          )}
        </form>
      )}
      {reopenError && <p className="error">{reopenError}</p>}
    </div>
  );
}
