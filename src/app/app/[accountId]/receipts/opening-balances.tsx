"use client";

import { useActionState } from "react";
import { saveOpeningBalancesAction } from "./actions";

export function OpeningBalances({
  accountId, fyLabel, openingCash, openingBank,
}: {
  accountId: string;
  fyLabel: string;
  openingCash: string;
  openingBank: string;
}) {
  const [message, action, pending] = useActionState(saveOpeningBalancesAction, null);

  return (
    <form action={action} className="card" style={{ marginBottom: "1.6rem" }}>
      <input type="hidden" name="accountId" value={accountId} />
      <div className="eyebrow">Opening balances brought forward · FY {fyLabel}</div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr) auto", gap: "1.25rem", alignItems: "end", marginTop: ".9rem" }}>
        <label className="field">Cash in hand (KES)
          <input name="openingCash" className="mono" inputMode="decimal"
            defaultValue={openingCash} placeholder="0" />
        </label>
        <label className="field">Balance at bank (KES)
          <input name="openingBank" className="mono" inputMode="decimal"
            defaultValue={openingBank} placeholder="0" />
        </label>
        <button type="submit" className="btn btn-quiet" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>

      <p className="note" style={{ marginTop: "1rem" }}>
        Last year&rsquo;s closing cash and bank. This is not a receipt and is charged to no vote
        head: it opens the cash book, and stands as the balance brought down on the trial balance
        all year. Changing it moves every book.
        {message && <strong style={{ color: "var(--gold)", marginLeft: ".5rem" }}>{message}</strong>}
      </p>
    </form>
  );
}
