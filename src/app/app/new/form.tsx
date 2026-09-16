"use client";

import { useActionState, useState } from "react";
import type { VoteHead } from "@/domain";
import { createBookAction } from "./actions";

export function NewBookForm({
  years, accountTypes,
}: {
  years: string[];
  accountTypes: { id: string; label: string; heads: VoteHead[] }[];
}) {
  const [error, action, pending] = useActionState(createBookAction, null);
  const [accountType, setAccountType] = useState(accountTypes[0].id);
  const heads = accountTypes.find((a) => a.id === accountType)?.heads ?? [];

  return (
    <form action={action} className="card stack">
      <label className="field">Name of school
        <input name="schoolName" placeholder="e.g. Ng'iya Girls High School" required />
      </label>

      <div className="grid-2">
        <label className="field">School level
          <select name="level" defaultValue="primary">
            <option value="primary">Primary</option>
            <option value="junior">Junior School</option>
            <option value="senior">Secondary</option>
          </select>
        </label>
        <label className="field">Financial year
          <select name="fyLabel" defaultValue={years[0]}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>

      <label className="field">Account type
        <select name="accountType" value={accountType} onChange={(e) => setAccountType(e.target.value)}>
          {accountTypes.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
      </label>

      <div style={{ borderTop: "1px solid var(--rule-soft)", paddingTop: "1.25rem" }}>
        <div className="eyebrow" style={{ marginBottom: ".75rem" }}>Vote heads that will be opened</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem" }}>
          {heads.map((h) => (
            <div key={h.code} style={{ border: "1px solid var(--rule-card)", borderRadius: 3, padding: ".45rem .7rem", fontSize: ".82rem", background: "var(--paper)" }}>
              <span className="code" style={{ marginRight: ".5rem" }}>{h.code}</span>{h.name}
            </div>
          ))}
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      <button type="submit" className="btn btn-primary" style={{ alignSelf: "flex-start" }} disabled={pending}>
        {pending ? "Creating…" : "Create the book"}
      </button>
    </form>
  );
}
