"use client";

import { useActionState, useState } from "react";
import { formatKes, toCents, type VoteHead } from "@/domain";
import { postPayment } from "./actions";

export function PaymentForm({
  accountId, heads, balances,
}: {
  accountId: string;
  heads: VoteHead[];
  balances: Record<string, number>;
}) {
  const [error, action, pending] = useActionState(postPayment, null);
  const [amount, setAmount] = useState("");
  const [voteHead, setVoteHead] = useState(heads[0]?.code ?? "");

  const asked = toCents(parseFloat(amount.replace(/[^0-9.]/g, "")) || 0);
  const available = balances[voteHead] ?? 0;
  const note = !asked
    ? "Enter the amount to post."
    : asked > available
      ? `Virement: ${formatKes(asked - available)} over ${voteHead} will come from another vote head.`
      : `${formatKes(available - asked)} will remain on ${voteHead}.`;

  return (
    <form action={action} className="card">
      <input type="hidden" name="accountId" value={accountId} />

      <div className="grid-4">
        <label className="field">Date
          <input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
        </label>
        <label className="field">Voucher no.
          <input name="vrNo" placeholder="VR/207" />
        </label>
        <label className="field">Cheque no.
          <input name="chequeNo" placeholder="001432" />
        </label>
        <label className="field">Amount (KES)
          <input name="amount" className="mono" inputMode="decimal" placeholder="0"
            value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr) minmax(0,.7fr)", gap: "1.25rem", marginTop: "1.25rem" }}>
        <label className="field">Paid to / particulars
          <input name="particulars" placeholder="Text Book Centre — exercise books" />
        </label>
        <label className="field">Vote head
          <select name="voteHead" value={voteHead} onChange={(e) => setVoteHead(e.target.value)}>
            {heads.map((h) => (
              <option key={h.code} value={h.code}>{h.code} — {h.name}</option>
            ))}
          </select>
        </label>
        <label className="field">Paid by
          <select name="method" defaultValue="bank">
            <option value="bank">Bank</option>
            <option value="cash">Cash</option>
          </select>
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "1.1rem", marginTop: "1.4rem", flexWrap: "wrap" }}>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Posting…" : "Post payment"}
        </button>
        <div className="note">{note}</div>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
