"use client";

import { useActionState, useState } from "react";
import { LEVEL_LABEL, formatKes, priceLabel, type SchoolLevel } from "@/domain";
import { createBookAction } from "./actions";

interface ChartOption {
  id: string;
  label: string;
  source: string | null;
  heads: { code: string; name: string }[];
}

export function NewBookForm({
  years, levels, charts, covered, freeUsed, isOwner, defaultPhone, testAmountCents, preset = {},
}: {
  years: string[];
  levels: { id: SchoolLevel; label: string }[];
  charts: Record<string, ChartOption[]>;
  /** Level-and-year pairs the org may already open. */
  covered: { level: string; fyLabel: string }[];
  /** Whether the one free school has already been given. */
  freeUsed: boolean;
  isOwner: boolean;
  defaultPhone: string;
  /** Set while Tuma is in sandbox: what will really be charged. */
  testAmountCents: number | null;
  /** Filled in when opening next year's book of an existing one. */
  preset?: { school?: string; level?: string; type?: string; fy?: string };
}) {
  const [error, action, pending] = useActionState(createBookAction, null);
  // Nothing preselected. The level, the year and the account fix the chart and
  // the twelve periods for good, so each one is chosen deliberately rather
  // than left at whatever happened to be first in the list.
  const [level, setLevel] = useState<SchoolLevel | "">(
    levels.some((l) => l.id === preset.level) ? preset.level as SchoolLevel : "",
  );
  const [accountType, setAccountType] = useState(preset.type ?? "");
  const [fyLabel, setFyLabel] = useState(years.includes(preset.fy ?? "") ? preset.fy! : "");

  const options = level === "" ? [] : charts[level] ?? [];
  const chosen = options.find((o) => o.id === accountType);
  const ready = level !== "" && fyLabel !== "" && chosen !== undefined;

  // Shown the moment level and year are both known, so the price is seen
  // before the form is finished rather than after it is refused.
  const needsPayment = !isOwner && freeUsed && level !== "" && fyLabel !== ""
    && !covered.some((c) => c.level === level && c.fyLabel === fyLabel);

  const onLevel = (next: SchoolLevel | "") => {
    setLevel(next);
    // The chart changes with the level, so an account chosen under the old one
    // is cleared rather than silently carried to a chart it may not exist in.
    const nextOptions = next === "" ? [] : charts[next] ?? [];
    if (!nextOptions.some((o) => o.id === accountType)) setAccountType("");
  };

  return (
    <form action={action} className="card stack">
      <label className="field">Name of school
        <input name="schoolName" placeholder="e.g. Ng'iya Girls High School" defaultValue={preset.school} required />
        <span className="note">
          Spell it the same way for every book of this school. Open operations alongside tuition
          under the same name and they share one school, and one subscription for that level and
          year. Once entries are posted the name is fixed.
        </span>
      </label>

      <div className="grid-2">
        <label className="field">School level
          <select
            name="level"
            value={level}
            required
            onChange={(e) => onLevel(e.target.value as SchoolLevel | "")}
          >
            <option value="">Choose the level…</option>
            {levels.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </label>
        <label className="field">Financial year
          <select name="fyLabel" value={fyLabel} required onChange={(e) => setFyLabel(e.target.value)}>
            <option value="">Choose the year…</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>

      <label className="field">Account
        <select
          name="accountType"
          value={accountType}
          required
          disabled={level === ""}
          onChange={(e) => setAccountType(e.target.value)}
        >
          <option value="">
            {level === "" ? "Choose the school level first" : "Choose the account…"}
          </option>
          {options.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
      </label>

      <div style={{ borderTop: "1px solid var(--rule-soft)", paddingTop: "1.25rem" }}>
        <div className="eyebrow" style={{ marginBottom: ".75rem" }}>Vote heads that will be opened</div>
        {!chosen && <p className="note" style={{ margin: 0 }}>Choose the level and the account to see them.</p>}
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
            KSh {priceLabel(level as SchoolLevel)} for {fyLabel}, covering every account this
            school keeps at {LEVEL_LABEL[level as SchoolLevel].toLowerCase()} level for the year.
            Pay here and the book opens as soon as the payment goes through — you will not type
            this form again.
          </p>
          {testAmountCents !== null && (
            <p className="error" style={{ margin: "0 0 1rem" }}>
              Test amount: KSh {formatKes(testAmountCents)} will actually be charged, not the
              list price above.
            </p>
          )}
          <label className="field" style={{ maxWidth: 320 }}>M-Pesa number
            <input name="phone" defaultValue={defaultPhone} placeholder="0712 345 678" inputMode="tel" />
          </label>
        </div>
      )}

      {/* NEEDS_PAYMENT is the server telling the form to ask for the number,
          not a fault the bursar should read. */}
      {error && error !== "NEEDS_PAYMENT" && <p className="error">{error}</p>}

      <button
        type="submit"
        className="btn btn-primary"
        style={{ alignSelf: "flex-start" }}
        disabled={pending || !ready}
      >
        {pending
          ? (needsPayment ? "Sending the request…" : "Creating…")
          : !ready
            ? "Choose the level, year and account"
            : needsPayment
              ? `Pay KSh ${testAmountCents === null ? priceLabel(level as SchoolLevel) : formatKes(testAmountCents)} and create the book`
              : "Create the book"}
      </button>
    </form>
  );
}
