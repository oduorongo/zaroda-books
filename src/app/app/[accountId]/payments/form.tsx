"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { formatKes, toCents, type VoteHead } from "@/domain";
import { amendPayment, postPayment } from "./actions";

/** A posted payment reopened for amendment. */
export interface PaymentDraft {
  id: string;
  date: string;
  vrNo: string;
  chequeNo: string;
  particulars: string;
  method: string;
  amounts: Record<string, string>;
}

const num = (v: string) => {
  const n = parseFloat(v.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export function PaymentForm({
  accountId, heads, balances, cashInHand, payment,
}: {
  accountId: string;
  heads: VoteHead[];
  balances: Record<string, number>;
  cashInHand: number;
  payment?: PaymentDraft;
}) {
  const [error, action, pending] = useActionState(payment ? amendPayment : postPayment, null);
  const [amounts, setAmounts] = useState<Record<string, string>>(payment?.amounts ?? {});
  const [method, setMethod] = useState(payment?.method ?? "bank");

  const charged = (code: string) => toCents(num(amounts[code] ?? ""));
  // The payment is the sum of its lines, never a figure typed separately, so
  // the allocations cannot fail to equal what was paid. Rule 2.
  const total = heads.reduce((a, h) => a + charged(h.code), 0);
  const overdrawn = heads.filter((h) => charged(h.code) > (balances[h.code] ?? 0));

  // Capitation is banked, so paying cash without drawing it first sends cash
  // in hand negative — and a month cannot close on a negative cash balance.
  const shortOfCash = method === "cash" && total > cashInHand;

  const note = !total
    ? "Enter an amount against each vote head this payment is charged to."
    : overdrawn.length
      ? `Virement: ${overdrawn.map((h) => h.code).join(", ")} ${
          overdrawn.length > 1 ? "are" : "is"
        } charged beyond what the vote holds.`
      : `${formatKes(total)} across ${heads.filter((h) => charged(h.code) > 0).length} vote head(s).`;

  return (
    <form action={action} className="card">
      <input type="hidden" name="accountId" value={accountId} />
      {payment && <input type="hidden" name="transactionId" value={payment.id} />}

      <div className="grid-4">
        <label className="field">Date
          <input name="date" type="date" defaultValue={payment?.date ?? new Date().toISOString().slice(0, 10)} required />
        </label>
        <label className="field">Voucher no.
          {/* Derived from the date across the whole year, so it is shown, not
              typed. Saving a payment dated earlier renumbers the ones after it. */}
          <input value={payment?.vrNo ?? "assigned on save"} readOnly disabled />
        </label>
        <label className="field">Cheque no.
          {/* A cash payment has no cheque, so the box is shut rather than left
              open to be filled in by habit. */}
          <input
            name="chequeNo"
            placeholder={method === "cash" ? "Not used for cash" : "001432"}
            defaultValue={payment?.chequeNo}
            disabled={method === "cash"}
          />
        </label>
        <label className="field">Paid by
          <select name="method" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="bank">Bank</option>
            <option value="cash">Cash</option>
          </select>
        </label>
      </div>

      <label className="field" style={{ marginTop: "1.25rem" }}>Payee / paid to
        <input name="particulars" placeholder="Text Book Centre — exercise books" defaultValue={payment?.particulars} required />
      </label>

      <div className="eyebrow" style={{ margin: "1.75rem 0 .6rem" }}>Charged to</div>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Vote head</th>
              <th className="n">Amount</th>
              <th className="n">On the vote now</th>
              <th className="n">If you post this</th>
            </tr>
          </thead>
          <tbody>
            {heads.map((h) => {
              const available = balances[h.code] ?? 0;
              const line = charged(h.code);
              return (
                <tr key={h.code}>
                  <td><span className="code" style={{ marginRight: ".6rem" }}>{h.code}</span>{h.name}</td>
                  <td className="n">
                    <input
                      name={`amount_${h.code}`} className="mono" inputMode="decimal" placeholder="—"
                      style={{ width: 118, textAlign: "right", padding: ".5rem .6rem" }}
                      value={amounts[h.code] ?? ""}
                      onChange={(e) => setAmounts({ ...amounts, [h.code]: e.target.value })}
                    />
                  </td>
                  <td className="n" style={{ color: "var(--muted)" }}>{formatKes(available)}</td>
                  <td className="n" style={line > available ? { color: "var(--alarm)" } : undefined}>
                    {/* A bare negative here was read as the vote's actual balance.
                        Saying "overdrawn by" names it for what it is: what this
                        payment would do, not what the books currently say. */}
                    {!line
                      ? "—"
                      : line > available
                        ? `Overdrawn by ${formatKes(line - available)}`
                        : formatKes(available - line)}
                  </td>
                </tr>
              );
            })}
            <tr className="total">
              <td colSpan={3}>Total paid</td>
              <td className="n">{formatKes(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "1.1rem", marginTop: "1.4rem", flexWrap: "wrap" }}>
        <button type="submit" className="btn btn-primary" disabled={pending || !total}>
          {pending ? "Saving…" : payment ? "Save changes" : "Post payment"}
        </button>
        <div className="note">{note}</div>
      </div>
      {shortOfCash && (
        <p className="note" style={{ marginTop: ".9rem", color: "var(--alarm)" }}>
          Cash in hand is {formatKes(cashInHand)}, so this leaves it{" "}
          {formatKes(total - cashInHand)} short. Draw the cash from the bank first on the{" "}
          <Link href={`/app/${accountId}/cash-and-bank`}>cash and bank</Link> page — a month cannot
          be closed while cash in hand is negative.
        </p>
      )}
      {error && <p className="error">{error}</p>}
    </form>
  );
}
