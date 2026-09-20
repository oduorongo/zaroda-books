"use client";

import { useActionState, useState } from "react";
import { priceLabel, type SchoolLevel } from "@/domain";
import { createBookAction } from "./actions";

interface ChartOption {
  id: string;
  label: string;
  source: string | null;
  heads: { code: string; name: string }[];
}

export function NewBookForm({
  years, levels, charts, covered, isOwner, defaultPhone,
}: {
  years: string[];
  levels: { id: SchoolLevel; label: string }[];
  charts: Record<string, ChartOption[]>;
  /** Level-and-year pairs the org may already open. */
  covered: { level: string; fyLabel: string }[];
  isOwner: boolean;
  defaultPhone: string;
}) {
  const [error, action, pending] = useActionState(createBookAction, null);
  const [level, setLevel] = useState<SchoolLevel>(levels[0].id);
  const [accountType, setAccountType] = useState(charts[levels[0].id][0].id);
  const [fyLabel, setFyLabel] = useState(years[0]);

  // Shown the moment the pair is uncovered, so the price is known before the
  // form is filled in rather than after it is refused.
  const needsPayment = !isOwner
    && !covered.some((c) => c.level === level && c.fyLabel === fyLabel);

  const options = charts[level] ?? [];
  const chosen = options.find((o) => o.id === accountType) ?? options[0];

  const onLevel = (next: SchoolLevel) => {
    setLevel(next);
    // The chart changes with the level; keep the same account if it exists there.
    const nextOptions = charts[next] ?? [];
    if (!nextOptions.some((o) => o.id === accountType)) {
      setAccountType(nextOptions[0]?.id ?? "");
    }
  };

  return (
    <form action={action} className="card stack">
      <label className="field">Name of school
        <input name="schoolName" placeholder="e.g. Ng'iya Girls High School" required />
        <span className="note">
          Spell it the same way for every book of this school. Open operations alongside tuition
          under the same name and they share one school, and one subscription for that level and
          year. Once entries are posted the name is fixed.
        </span>
      </label>

      <div className="grid-2">
        <label className="field">School level
          <select name="level" value={level} onChange={(e) => onLevel(e.target.value as SchoolLevel)}>
            {levels.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </label>
        <label className="field">Financial year
          <select name="fyLabel" value={fyLabel} onChange={(e) => setFyLabel(e.target.value)}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>

      <label className="field">Account
        <select name="accountType" value={chosen?.id ?? ""} onChange={(e) => setAccountType(e.target.value)}>
          {options.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
      </label>

      <div style={{ borderTop: "1px solid var(--rule-soft)", paddingTop: "1.25rem" }}>
        <div className="eyebrow" style={{ marginBottom: ".75rem" }}>Vote heads that will be opened</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem" }}>
          {chosen?.heads.map((h) => (
            <div key={h.code} style={{ border: "1px solid var(--rule-card)", borderRadius: 3, padding: ".45rem .7rem", fontSize: ".82rem", background: "var(--paper)" }}>
              <span className="code" style={{ marginRight: ".5rem" }}>{h.code}</span>{h.name}
            </div>
          ))}
        </div>
        {chosen?.source && (
          <p className="note" style={{ marginTop: ".9rem" }}>
            {chosen.source}. Only what is banked for the school appears here — centrally procured
            items are left out. The rates are pre-filled and can be edited per disbursement.
          </p>
        )}
      </div>

      {needsPayment && (
        <div style={{ borderTop: "1px solid var(--rule-soft)", paddingTop: "1.25rem" }}>
          <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: ".4rem" }}>
            This level and year needs a subscription
          </div>
          <p className="note" style={{ margin: "0 0 1rem", lineHeight: 1.6 }}>
            KSh {priceLabel(level)} for {fyLabel}, covering every account this school keeps at{" "}
            {level} level for the year. Pay here and the book opens as soon as the payment goes
            through — you will not type this form again.
          </p>
          <label className="field" style={{ maxWidth: 320 }}>M-Pesa number
            <input name="phone" defaultValue={defaultPhone} placeholder="0712 345 678" inputMode="tel" />
          </label>
        </div>
      )}

      {/* NEEDS_PAYMENT is the server telling the form to ask for the number,
          not a fault the bursar should read. */}
      {error && error !== "NEEDS_PAYMENT" && <p className="error">{error}</p>}

      <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }} disabled={pending}>
        {pending
          ? (needsPayment ? "Sending the request…" : "Creating…")
          : (needsPayment ? `Pay KSh ${priceLabel(level)} and create the book` : "Create the book")}
      </button>
    </form>
  );
}
