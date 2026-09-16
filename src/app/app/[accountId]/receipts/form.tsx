"use client";

import { useActionState, useState } from "react";
import { allocateCapitationFromAmount, formatKes, toCents, type VoteHead } from "@/domain";
import { postReceipt } from "./actions";

interface HeadEntry { rate: string; flat: string }

const num = (v: string) => {
  const n = parseFloat(v.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

export function ReceiptForm({
  accountId, heads,
}: {
  accountId: string;
  heads: VoteHead[];
}) {
  const [error, action, pending] = useActionState(postReceipt, null);
  const [amount, setAmount] = useState("");
  const [entries, setEntries] = useState<Record<string, HeadEntry>>({});

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
  const basic = { voteHeadCode: heads[heads.length - 1]?.code ?? "" };

  const { enrolment, allocations } = disbursed > 0 && (rateList.length || flatList.length)
    ? allocateCapitationFromAmount(disbursed, rateList, basic, flatList)
    : { enrolment: 0, allocations: [] };
  const byCode = Object.fromEntries(allocations.map((a) => [a.voteHeadCode, a.amount]));
  const distributed = allocations.reduce((a, x) => a + x.amount, 0);
  const flatTotal = flatList.reduce((a, f) => a + f.amount, 0);

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

      <div className="grid-4">
        <label className="field">Date
          <input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
        </label>
        <label className="field">Receipt no.
          <input name="receiptNo" placeholder="RV/014" />
        </label>
        <label className="field">Amount received (KES)
          <input name="amount" className="mono" inputMode="decimal" placeholder="0"
            value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </label>
        <div className="field">Learners (computed)
          <div className="mono" style={{ padding: ".8rem .85rem", border: "1px dashed var(--rule)", borderRadius: 3, background: "var(--band)", display: "flex", justifyContent: "space-between", gap: ".6rem" }}>
            <span>{enrolment ? enrolment.toLocaleString("en-KE") : "—"}</span>
            <span className="code" style={{ fontSize: ".68rem", letterSpacing: ".1em", textTransform: "uppercase", alignSelf: "center" }}>Auto</span>
          </div>
        </div>
      </div>

      <label className="field" style={{ marginTop: "1.25rem" }}>Particulars
        <input name="particulars" placeholder="Capitation disbursement, Term 1" />
      </label>

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
                      name={`rate_${h.code}`} className="mono" inputMode="decimal" placeholder="—"
                      style={{ width: 104, textAlign: "right", padding: ".5rem .6rem" }}
                      value={e.rate} onChange={(ev) => set(h.code, "rate", ev.target.value)}
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

      <div style={{ display: "flex", alignItems: "center", gap: "1.1rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
        <button type="submit" className="btn btn-primary" disabled={pending || !distributed}>
          {pending ? "Posting…" : "Post receipt"}
        </button>
        <div className="note">{note}</div>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
