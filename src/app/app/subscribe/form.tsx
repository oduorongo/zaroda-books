"use client";

import { useActionState, useState } from "react";
import { LEVEL_PRICE, formatKes, priceLabel } from "@/domain";
import type { SchoolLevel } from "@/domain";
import { payAction } from "./actions";

const LEVELS: { id: SchoolLevel; label: string }[] = [
  { id: "primary", label: "Primary" },
  { id: "junior", label: "Junior school" },
  { id: "senior", label: "Secondary" },
];

export function SubscribeForm({ years, defaultPhone }: {
  years: string[];
  defaultPhone: string;
}) {
  const [error, action, pending] = useActionState(payAction, null);
  const [level, setLevel] = useState<SchoolLevel>("primary");

  return (
    <form action={action} className="card stack" style={{ maxWidth: 620 }}>
      <div className="grid-2">
        <label className="field">School level
          <select name="level" value={level} onChange={(e) => setLevel(e.target.value as SchoolLevel)}>
            {LEVELS.map((l) => (
              <option key={l.id} value={l.id}>{l.label} — KSh {priceLabel(l.id)}</option>
            ))}
          </select>
        </label>
        <label className="field">Financial year
          <select name="fyLabel">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>

      <label className="field">M-Pesa number
        <input
          name="phone"
          defaultValue={defaultPhone}
          placeholder="0712 345 678"
          inputMode="tel"
          required
        />
      </label>

      <div style={{ display: "flex", alignItems: "baseline", gap: ".5rem" }}>
        <span className="eyebrow">To pay</span>
        <span style={{ fontFamily: "var(--font-heading)", fontSize: "1.6rem", fontWeight: 700 }}>
          KSh {formatKes(LEVEL_PRICE[level])}
        </span>
      </div>

      {error && <p className="error">{error}</p>}

      <button type="submit" className="btn btn-gold" disabled={pending}>
        {pending ? "Sending the request…" : "Send M-Pesa request"}
      </button>

      <p className="note">
        A prompt comes to that phone. Enter the M-Pesa PIN on the handset to complete the payment.
        One payment covers every account that school keeps at that level, for the whole year.
      </p>
    </form>
  );
}
