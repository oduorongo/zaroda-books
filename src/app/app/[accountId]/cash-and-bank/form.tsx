"use client";

import { useActionState, useState } from "react";
import { formatKes, toCents, type EntryDates } from "@/domain";
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
  accountId, cash, bank, dates, transfer,
}: {
  accountId: string;
  /** Balances with this transfer left out, when amending one. */
  cash: number;
  bank: number;
  /** The book's year, which the calendar is held to. */
  dates: EntryDates;
  transfer?: TransferDraft;
}) {
  const [error, action, pending] = useActionState(transfer ? amendTransfer : postTransfer, null);
  const [direction, setDirection] = useState<string>(transfer?.direction ?? "to-cash");
  const [amount, setAmount] = useState(transfer?.amount ?? "");
  // Held in state so it survives a save: the next transfer is usually the same day.
  const [date, setDate] = useState(transfer?.date ?? dates.start);

  const asked = toCents(parseFloat(amount.replace(/[^0-9.]/g, "")) || 0);
  const available = direction === "to-bank" ? cash : bank;
  const source = direction === "to-bank" ? "cash in hand" : "the bank";

  const note = !asked
    ? "Enter the amount to move."
    : asked > available
      ? `This is ${formatKes(asked - available)} more than there is in ${source}.`
      : `${formatKes(available - asked)} will remain in ${source}.`;

  return (
    <form action={action} className="card">
      <input type="hidden" name="accountId" value={accountId} />
      {transfer && <input type="hidden" name="transactionId" value={transfer.id} />}

      <div className="grid-4">
        <label className="field">Date
          <input name="date" type="date" required min={dates.from} max={dates.to}
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
          <input name="chequeNo" placeholder="001432" defaultValue={transfer?.chequeNo} />
        </label>
      </div>

      <label className="field" style={{ marginTop: "1.25rem" }}>Particulars
        <input name="particulars" defaultValue={transfer?.particulars}
          placeholder={direction === "to-bank" ? "Banking" : "Cash drawn from bank"} />
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: "1.1rem", marginTop: "1.4rem", flexWrap: "wrap" }}>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : transfer ? "Save changes" : "Post transfer"}
        </button>
        <div className="note">{note}</div>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
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
