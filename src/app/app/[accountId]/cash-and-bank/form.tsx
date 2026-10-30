"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import {
  balancesAsAt, formatDate, formatKes, toCents, type Balances, type EntryDates, type MoneyMove,
} from "@/domain";
import { amendTransfer, deleteTransfer, postTransfer } from "./actions";

/** A posted transfer reopened for amendment. */
export interface TransferDraft {
  id: string;
  date: string;
  direction: "to-bank" | "to-cash";
  amount: string;
  chequeNo: string;
  particulars: string;
}

export function TransferForm({
  accountId, opening, moves, dates, transfer,
}: {
  accountId: string;
  /**
   * The cash and bank side of every other entry, so the balances are shown as
   * at the transfer's date — the date the server refuses by, not the year end.
   * When amending, this transfer is left out.
   */
  opening: Balances;
  moves: MoneyMove[];
  /** The book's year, which the calendar is held to. */
  dates: EntryDates;
  transfer?: TransferDraft;
}) {
  const [state, action, pending] = useActionState(transfer ? amendTransfer : postTransfer, null);
  const [direction, setDirection] = useState<string>(transfer?.direction ?? "to-cash");
  const [amount, setAmount] = useState(transfer?.amount ?? "");
  // Chosen on every transfer, never carried over: a transfer left on the
  // previous one's date lands in the wrong place in the cash book.
  const [date, setDate] = useState(transfer?.date ?? "");
  const [chequeNo, setChequeNo] = useState(transfer?.chequeNo ?? "");
  const [particulars, setParticulars] = useState(transfer?.particulars ?? "");
  const dateBox = useRef<HTMLInputElement>(null);

  // Posted: start clean for the next transfer, the date included.
  const posted = state?.posted;
  useEffect(() => {
    if (!posted) return;
    setDirection("to-cash");
    setAmount("");
    setDate("");
    setChequeNo("");
    setParticulars("");
    dateBox.current?.focus();
  }, [posted]);

  // Submitted by hand rather than through the form's action, which would
  // reset the fields even when the save is refused.
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => action(data));
  };

  // With no date chosen, everything posted so far.
  const balances = balancesAsAt(opening, moves, date || "9999-12-31");
  const asked = toCents(parseFloat(amount.replace(/[^0-9.]/g, "")) || 0);
  const available = direction === "to-bank" ? balances.cash : balances.bank;
  const source = direction === "to-bank" ? "cash in hand" : "the bank";
  const on = date ? ` on ${formatDate(date)}` : "";

  const note = !asked
    ? "Enter the amount to move."
    : asked > available
      ? `This is ${formatKes(asked - available)} more than there was in ${source}${on}.`
      : `${formatKes(available - asked)} will remain in ${source}${on}.`;

  return (
    <>
      <div className="grid-2" style={{ marginBottom: "1.6rem" }}>
        <div className="card">
          <div className="note">Cash in hand{date ? on : " (all entries)"}</div>
          <div className="mono" style={{ fontSize: "1.5rem", marginTop: ".35rem", fontWeight: date ? 700 : undefined }}>
            {formatKes(balances.cash)}
          </div>
        </div>
        <div className="card">
          <div className="note">Balance at bank{date ? on : " (all entries)"}</div>
          <div className="mono" style={{ fontSize: "1.5rem", marginTop: ".35rem", fontWeight: date ? 700 : undefined }}>
            {formatKes(balances.bank)}
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="card">
        {posted && (
          <p style={{ margin: "0 0 1.25rem", padding: ".75rem 1rem", borderRadius: 3, border: "1px solid var(--gold)", background: "var(--band)" }}>
            Transfer posted — {formatKes(posted.amount)} {posted.toBank ? "banked" : "drawn from the bank"} on{" "}
            {formatDate(posted.date)}.
            <span className="note" style={{ display: "block", marginTop: ".25rem" }}>Ready for the next transfer.</span>
          </p>
        )}
        <input type="hidden" name="accountId" value={accountId} />
        {transfer && <input type="hidden" name="transactionId" value={transfer.id} />}

        <div className="grid-4">
          <label className="field">Date
            <input name="date" type="date" required min={dates.from} max={dates.to} ref={dateBox}
              value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">Direction
            <select name="direction" value={direction} onChange={(e) => setDirection(e.target.value)}>
              <option value="to-cash">Draw cash from the bank</option>
              <option value="to-bank">Bank the cash</option>
            </select>
          </label>
          <label className="field">Amount (KES)
            <input name="amount" className="mono" inputMode="decimal" placeholder="0"
              value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </label>
          <label className="field">Cheque no.
            <input name="chequeNo" placeholder="001432" value={chequeNo} onChange={(e) => setChequeNo(e.target.value)} />
          </label>
        </div>

        <label className="field" style={{ marginTop: "1.25rem" }}>Particulars
          <input name="particulars" value={particulars} onChange={(e) => setParticulars(e.target.value)}
            placeholder={direction === "to-bank" ? "Banking" : "Cash drawn from bank"} />
        </label>

        <div style={{ display: "flex", alignItems: "center", gap: "1.1rem", marginTop: "1.4rem", flexWrap: "wrap" }}>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Saving…" : transfer ? "Save changes" : "Post transfer"}
          </button>
          <div className="note">{note}</div>
        </div>
        {state?.error && <p className="error">{state.error}</p>}
      </form>
    </>
  );
}

export function DeleteTransfer({
  accountId, transactionId,
}: {
  accountId: string;
  transactionId: string;
}) {
  const [error, action, pending] = useActionState(deleteTransfer, null);

  return (
    <form
      action={action}
      style={{ marginTop: "1.6rem" }}
      onSubmit={(e) => {
        if (!confirm("Delete this transfer? This cannot be undone.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="transactionId" value={transactionId} />
      <button type="submit" className="btn" disabled={pending} style={{ color: "var(--alarm)" }}>
        {pending ? "Deleting…" : "Delete this transfer"}
      </button>
      <span className="note" style={{ marginLeft: "1rem" }}>
        For a transfer posted in error or entered twice. The deletion is written to the audit log.
      </span>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
