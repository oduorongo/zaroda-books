"use client";

import { useActionState, useState } from "react";
import { allocateCapitationFromAmount, enrolmentFit, formatKes, residualHeadCode, toCents, type VoteHead } from "@/domain";
import { amendReceipt, postReceipt } from "./actions";

interface HeadEntry { rate: string; flat: string }

/** A posted receipt reopened for amendment, with the figures it was worked from. */
export interface ReceiptDraft {
  id: string;
  date: string;
  receiptNo: string;
  particulars: string;
  amount: string;
  entries: Record<string, HeadEntry>;
  /** The date this receipt was banked, or null if it stayed in the cash box. */
  bankedOn: string | null;
}

const num = (v: string) => {
  const n = parseFloat(v.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export function ReceiptForm({
  accountId, heads, receipt, flatOnly = [], capitation = true,
}: {
  accountId: string;
  heads: VoteHead[];
  receipt?: ReceiptDraft;
  /** Codes the circular funds per school: their rate box stays shut. */
  flatOnly?: string[];
  /**
   * Whether this account receives capitation. Boarding, lunch and the other
   * accounts parents pay into have no circular and no rate per learner, so
   * there is no enrolment to derive and the box is left off entirely.
   */
  capitation?: boolean;
}) {
  const [error, action, pending] = useActionState(receipt ? amendReceipt : postReceipt, null);
  const [amount, setAmount] = useState(receipt?.amount ?? "");
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(receipt?.date ?? today);
  // Every shilling arrives as cash and is banked, so the tick starts on.
  const [banked, setBanked] = useState(receipt ? receipt.bankedOn !== null : true);
  const [bankedOn, setBankedOn] = useState(receipt?.bankedOn ?? receipt?.date ?? today);
  // A new receipt starts blank. Only an amendment opens on figures, and they
  // are the ones that receipt was actually posted from.
  const [entries, setEntries] = useState<Record<string, HeadEntry>>(receipt?.entries ?? {});

  const entry = (code: string) => entries[code] ?? { rate: "", flat: "" };
  const set = (code: string, field: keyof HeadEntry, value: string) =>
    setEntries({ ...entries, [code]: { ...entry(code), [field]: value } });

  // The same domain function the server posts with, so the preview and the
  // posted split can never disagree.
  const disbursed = toCents(num(amount));
  const rateList = heads
    .map((h) => ({ voteHeadCode: h.code, perLearner: toCents(num(entry(h.code).rate)) }))
    .filter((r) => r.perLearner > 0);
  const flatList = heads
    .map((h) => ({ voteHeadCode: h.code, amount: toCents(num(entry(h.code).flat)) }))
    .filter((f) => f.amount > 0);
  const basic = { voteHeadCode: residualHeadCode(rateList, flatList, heads.map((h) => h.code)) };

  const { enrolment, allocations } = disbursed > 0 && (rateList.length || flatList.length)
    ? allocateCapitationFromAmount(disbursed, rateList, basic, flatList)
    : { enrolment: 0, allocations: [] };
  const byCode = Object.fromEntries(allocations.map((a) => [a.voteHeadCode, a.amount]));
  const distributed = allocations.reduce((a, x) => a + x.amount, 0);
  const flatTotal = flatList.reduce((a, f) => a + f.amount, 0);

  // Whole cents times whole learners is exact, so any difference at all means
  // the amount, a rate or a flat disagrees with the others. Say so before it is
  // posted rather than rounding it into the residual vote unnoticed.
  const fit = disbursed > 0 && (rateList.length || flatList.length)
    ? enrolmentFit(disbursed, rateList, flatList)
    : null;
  const mismatch = fit && fit.difference !== 0 ? fit : null;

  const note = !disbursed
    ? "Enter the amount received, then the rates and any flat amounts from the circular."
    : !rateList.length && !flatList.length
      ? "Enter at least one rate per learner, or a flat amount."
      : rateList.length && enrolment <= 0
        ? "The flat amounts use up the whole disbursement — nothing is left per learner."
        : `${enrolment.toLocaleString("en-KE")} learners at the rates entered${
            flatTotal ? `, after ${formatKes(flatTotal)} of flat grants` : ""
          }. The residue falls to ${basic.voteHeadCode}.`;

  return (
    <form action={action} className="card">
      <input type="hidden" name="accountId" value={accountId} />
      {receipt && <input type="hidden" name="transactionId" value={receipt.id} />}

      <div className={capitation ? "grid-4" : "grid-3"}>
        {/* The date the money was received. Everything downstream — which
            month this posts into, the cash book, the ledger — is organised
            around it, so it stays a plain required field rather than being
            folded into the banking date below, which is a separate, later
            event. */}
        <label className="field">Date received
          <input name="date" type="date" value={date} required
            onChange={(e) => {
              setDate(e.target.value);
              // The banking follows the receipt unless it has been moved on purpose.
              if (bankedOn < e.target.value) setBankedOn(e.target.value);
            }} />
        </label>
        <label className="field">Receipt no.
          <input name="receiptNo" placeholder="RV/014" defaultValue={receipt?.receiptNo} />
        </label>
        <label className="field">Amount received (KES)
          <input name="amount" className="mono" inputMode="decimal" placeholder="0"
            value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </label>
        {capitation && (
          <div className="field">Learners (computed)
            <div className="mono" style={{ padding: ".8rem .85rem", border: "1px dashed var(--rule)", borderRadius: 3, background: "var(--band)", display: "flex", justifyContent: "space-between", gap: ".6rem" }}>
              <span>{enrolment ? enrolment.toLocaleString("en-KE") : "—"}</span>
              <span className="code" style={{ fontSize: ".68rem", letterSpacing: ".1em", textTransform: "uppercase", alignSelf: "center" }}>Auto</span>
            </div>
          </div>
        )}
      </div>

      <label className="field" style={{ marginTop: "1.25rem" }}>Particulars
        <input name="particulars" placeholder="Capitation disbursement, Term 1" defaultValue={receipt?.particulars} />
      </label>

      <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
          <input type="checkbox" name="banked" checked={banked}
            onChange={(e) => setBanked(e.target.checked)} />
          Banked
        </label>
        {/* Defaults to the date received and only needs touching when the
            deposit happened on a later day, so it reads as a footnote to
            "Banked" rather than a second date of equal weight. */}
        <label className="field" style={{ margin: 0 }}>Date banked, if later
          <input name="bankedOn" type="date" value={bankedOn} min={date} disabled={!banked}
            onChange={(e) => setBankedOn(e.target.value)} />
        </label>
        <p className="note" style={{ flex: "1 1 18rem", margin: 0 }}>
          {banked
            ? "Same day as received unless changed above. A contra moves it from cash to bank on that date. Untick Banked only if the money stayed in the cash box."
            : "The money stays in cash. Bank it later from Cash and bank."}
        </p>
      </div>

      <div className="eyebrow" style={{ margin: "1.75rem 0 .6rem" }}>Vote distribution per circular</div>
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Vote head</th>
              <th className="n">Rate per learner</th>
              <th className="n">Flat amount</th>
              <th className="n">Learners</th>
              <th className="n">Amount</th>
            </tr>
          </thead>
          <tbody>
            {heads.map((h) => {
              const e = entry(h.code);
              const rated = num(e.rate) > 0;
              return (
                <tr key={h.code}>
                  <td><span className="code" style={{ marginRight: ".6rem" }}>{h.code}</span>{h.name}</td>
                  <td className="n">
                    <input
                      name={`rate_${h.code}`} className="mono" inputMode="decimal"
                      placeholder={flatOnly.includes(h.code) ? "per school" : "—"}
                      disabled={flatOnly.includes(h.code)}
                      title={flatOnly.includes(h.code)
                        ? "The circular funds this head per school, not per learner."
                        : undefined}
                      style={{ width: 104, textAlign: "right", padding: ".5rem .6rem" }}
                      value={flatOnly.includes(h.code) ? "" : e.rate}
                      onChange={(ev) => set(h.code, "rate", ev.target.value)}
                    />
                  </td>
                  <td className="n">
                    <input
                      name={`flat_${h.code}`} className="mono" inputMode="decimal" placeholder="—"
                      style={{ width: 118, textAlign: "right", padding: ".5rem .6rem" }}
                      value={e.flat} onChange={(ev) => set(h.code, "flat", ev.target.value)}
                    />
                  </td>
                  <td className="n" style={{ color: "var(--muted)" }}>
                    {rated && enrolment ? enrolment.toLocaleString("en-KE") : "—"}
                  </td>
                  <td className="n">{byCode[h.code] ? formatKes(byCode[h.code]) : "—"}</td>
                </tr>
              );
            })}
            <tr className="total">
              <td colSpan={4}>Distributed</td>
              <td className="n">{formatKes(distributed)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {mismatch && (
        <div style={{ marginTop: "1.25rem", padding: "1rem 1.1rem", borderRadius: 3, border: "1px solid var(--alarm)", background: "#fdf6f4" }}>
          <div style={{ fontWeight: 600, color: "var(--alarm)" }}>
            {mismatch.difference < 0
              ? `${formatKes(-mismatch.difference)} short of the rates at ${mismatch.learners.toLocaleString("en-KE")} learners`
              : `${formatKes(mismatch.difference)} more than the rates account for at ${mismatch.learners.toLocaleString("en-KE")} learners`}
          </div>
          <p className="note" style={{ marginTop: ".4rem" }}>
            The amount divides to {mismatch.exact.toFixed(2)} learners, not a whole number. Check the
            amount received, each rate against the circular, and whether the bank deducted charges
            from the credit. You can still post: the difference falls on {basic.voteHeadCode}.
          </p>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "1.1rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
        <button type="submit" className="btn btn-primary" disabled={pending || !distributed}>
          {pending ? "Saving…" : receipt ? "Save changes" : "Post receipt"}
        </button>
        <div className="note">{note}</div>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
