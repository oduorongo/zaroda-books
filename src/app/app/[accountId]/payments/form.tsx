"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import {
  cashAsAt, formatKes, parseAmount, type EntryDates, voteBalancesAsAt, type CashMove, type VoteEntry, type VoteHead,
} from "@/domain";
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

export function PaymentForm({
  accountId, heads, entries, openingCash, cashMoves, dates, payment,
}: {
  accountId: string;
  heads: VoteHead[];
  /**
   * Every receipt and payment on these votes, so the balances can be shown
   * as they stood on the date being entered rather than at year end.
   */
  entries: VoteEntry[];
  /**
   * The cash side of every other entry, so cash in hand is shown as at the
   * payment's date — the date the server refuses by, not the year end.
   */
  openingCash: number;
  cashMoves: CashMove[];
  /** The book's year, which the calendar is held to. */
  dates: EntryDates;
  payment?: PaymentDraft;
}) {
  const [state, action, pending] = useActionState(payment ? amendPayment : postPayment, null);
  const [date, setDate] = useState(payment?.date ?? dates.start);
  const [amounts, setAmounts] = useState<Record<string, string>>(payment?.amounts ?? {});
  // No default: chosen on every voucher, so a cash payment is never posted as bank by habit.
  const [method, setMethod] = useState(payment?.method ?? "");
  const [particulars, setParticulars] = useState(payment?.particulars ?? "");
  const [chequeNo, setChequeNo] = useState(payment?.chequeNo ?? "");
  const payee = useRef<HTMLInputElement>(null);

  // Posted: clear for the next voucher. The date stays — vouchers are entered
  // in batches from the same day.
  const posted = state?.posted;
  useEffect(() => {
    if (!posted) return;
    setAmounts({});
    setMethod("");
    setParticulars("");
    setChequeNo("");
    payee.current?.focus();
  }, [posted]);

  // Submitted by hand rather than through the form's action, which would
  // reset the fields even when the save is refused and the figures are needed.
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => action(data));
  };
  const cashInHand = cashAsAt(openingCash, cashMoves, date);

  // One parser, shared with the server — see parse-amount.ts. Anything
  // unreadable counts as nothing here and is refused on save, rather than
  // silently becoming zero in a total.
  const charged = (code: string) => parseAmount(amounts[code] ?? "") || 0;
  const unreadable = heads.filter((h) => parseAmount(amounts[h.code] ?? "") === undefined);
  // The payment is the sum of its lines, never a figure typed separately, so
  // the allocations cannot fail to equal what was paid. Rule 2.
  const total = heads.reduce((a, h) => a + charged(h.code), 0);

  // Judged on the date being entered, not the year: a vote funded in June
  // did not fund a payment made in October.
  const balances = voteBalancesAsAt(entries, date);
  const overdrawn = heads.filter((h) => charged(h.code) > (balances[h.code] ?? 0));

  // Capitation is banked, so paying cash without drawing it first sends cash
  // in hand negative — and a month cannot close on a negative cash balance.
  const shortOfCash = method === "cash" && total > cashInHand;

  const note = unreadable.length
    ? `${unreadable.map((h) => h.code).join(", ")} cannot be read as a figure.`
    : !total
    ? "Enter an amount against each vote head this payment is charged to."
    : overdrawn.length
      ? `Virement: ${overdrawn.map((h) => h.code).join(", ")} ${
          overdrawn.length > 1 ? "are" : "is"
        } charged beyond what the vote holds.`
      : `${formatKes(total)} across ${heads.filter((h) => charged(h.code) > 0).length} vote head(s).`;

  return (
    <form onSubmit={submit} className="card">
      {posted && (
        <p style={{ margin: "0 0 1.25rem", padding: ".75rem 1rem", borderRadius: 3, border: "1px solid var(--gold)", background: "var(--band)" }}>
          VR {posted.vrNo} posted — {formatKes(posted.total)} to {posted.payee}.{" "}
          <Link href={`/app/${accountId}/payments/${posted.id}/voucher`}>View voucher</Link>
          {" · "}
          <Link href={`/app/${accountId}/payments/${posted.id}/edit`}>Amend</Link>
          <span className="note" style={{ display: "block", marginTop: ".25rem" }}>
            Ready for the next payment.
          </span>
        </p>
      )}
      <input type="hidden" name="accountId" value={accountId} />
      {payment && <input type="hidden" name="transactionId" value={payment.id} />}

      <div className="grid-4">
        <label className="field">Date
          <input name="date" type="date" min={dates.from} max={dates.to} value={date} onChange={(e) => setDate(e.target.value)} required />
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
            placeholder={method === "cash" ? "Not used for cash" : method ? "001432" : "Choose Paid by first"}
            value={method === "cash" ? "" : chequeNo}
            onChange={(e) => setChequeNo(e.target.value)}
            disabled={method !== "bank"}
          />
        </label>
        <label className="field">Paid by
          <select name="method" value={method} onChange={(e) => setMethod(e.target.value)} required>
            <option value="" disabled>— choose —</option>
            <option value="bank">Bank</option>
            <option value="cash">Cash</option>
          </select>
        </label>
      </div>

      <label className="field" style={{ marginTop: "1.25rem" }}>Payee / paid to
        <input name="particulars" placeholder="Text Book Centre — exercise books" required ref={payee}
          value={particulars} onChange={(e) => setParticulars(e.target.value)} />
      </label>

      <div className="eyebrow" style={{ margin: "1.75rem 0 .6rem" }}>Charged to</div>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Vote head</th>
              <th className="n">Amount</th>
              <th className="n">On the vote at that date</th>
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
              <td>Total paid</td>
              <td className="n">{formatKes(total)}</td>
              <td></td>
              <td></td>
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
          Cash in hand on {date} is {formatKes(cashInHand)}, so this leaves it{" "}
          {formatKes(total - cashInHand)} short. Draw the cash from the bank first on the{" "}
          <Link href={`/app/${accountId}/cash-and-bank`}>cash and bank</Link> page — a month cannot
          be closed while cash in hand is negative.
        </p>
      )}
      {state?.error && <p className="error">{state.error}</p>}
    </form>
  );
}
