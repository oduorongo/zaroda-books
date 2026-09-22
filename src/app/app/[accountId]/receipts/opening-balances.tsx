"use client";

import { useActionState } from "react";
import { previousFinancialYear } from "@/domain";
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
  const previous = previousFinancialYear(fyLabel);

  return (
    <form action={action} className="card" style={{ marginBottom: "1.6rem" }}>
      <input type="hidden" name="accountId" value={accountId} />
      {/* The year the money came FROM, not the one it is being carried into.
          Naming the current year read as though these were this year's closing
          figures. */}
      <div className="eyebrow">
        {previous
          ? `Opening balances brought forward from FY ${previous}`
          : `Opening balances brought forward into FY ${fyLabel}`}
      </div>
      <p className="note" style={{ margin: ".35rem 0 0" }}>
        {previous
          ? `The closing cash and bank shown on FY ${previous}'s balance sheet — entered once, `
            + "when this book is first set up, not on every receipt."
          : "The closing cash and bank shown on last year's balance sheet — entered once, when this "
            + "book is first set up, not on every receipt."}
      </p>

      <div className="field-row" style={{ marginTop: "1rem" }}>
        <label className="field">
          Cash in hand{previous ? ` — FY ${previous} closing` : " — last year's closing"}
          <input name="openingCash" className="mono" inputMode="decimal"
            defaultValue={openingCash} placeholder="0" />
        </label>
        <label className="field">
          Balance at bank{previous ? ` — FY ${previous} closing` : " — last year's closing"}
          <input name="openingBank" className="mono" inputMode="decimal"
            defaultValue={openingBank} placeholder="0" />
        </label>
        <button type="submit" className="btn btn-quiet" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
      </div>

      <p className="note" style={{ marginTop: "1rem" }}>
        This is not a receipt and is charged to no vote head: it opens the cash book, and stands
        as the balance brought down on the trial balance all year. Changing it moves every book.
        {message && <strong style={{ color: "var(--gold)", marginLeft: ".5rem" }}>{message}</strong>}
      </p>
    </form>
  );
}
