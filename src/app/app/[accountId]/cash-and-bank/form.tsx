"use client";

import { useActionState, useState } from "react";
import { formatKes, toCents } from "@/domain";
import { postTransfer } from "./actions";

export function TransferForm({
  accountId, cash, bank,
}: {
  accountId: string;
  cash: number;
  bank: number;
}) {
  const [error, action, pending] = useActionState(postTransfer, null);
  const [direction, setDirection] = useState("to-cash");
  const [amount, setAmount] = useState("");

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

      <div className="grid-4">
        <label className="field">Date
          <input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
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
          <input name="chequeNo" placeholder="001432" />
        </label>
      </div>

      <label className="field" style={{ marginTop: "1.25rem" }}>Particulars
        <input name="particulars"
          placeholder={direction === "to-bank" ? "Banking" : "Cash drawn from bank"} />
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: "1.1rem", marginTop: "1.4rem", flexWrap: "wrap" }}>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Posting…" : "Post transfer"}
        </button>
        <div className="note">{note}</div>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
