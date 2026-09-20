"use client";

import { useActionState, useState } from "react";
import { LEVEL_OPTIONS, LEVEL_PRICE, formatKes, priceLabel } from "@/domain";
import type { SchoolLevel } from "@/domain";
import { payAction } from "./actions";

export function SubscribeForm({ years, defaultPhone, testAmountCents }: {
  years: string[];
  defaultPhone: string;
  /** Set while Tuma is in sandbox: what will really be taken. */
  testAmountCents: number | null;
}) {
  const [error, action, pending] = useActionState(payAction, null);
  // Both start unchosen. A preselected level is the one a bursar pays for by
  // accident, and a subscription bought at the wrong level binds to nothing
  // they can use.
  const [level, setLevel] = useState<SchoolLevel | "">("");
  const [fyLabel, setFyLabel] = useState("");
  const chosen = level !== "" && fyLabel !== "";

  return (
    <form action={action} className="card stack" style={{ maxWidth: 620 }}>
      <div className="grid-2">
        <label className="field">School level
          <select
            name="level"
            value={level}
            required
            onChange={(e) => setLevel(e.target.value as SchoolLevel)}
          >
            <option value="">Choose the level…</option>
            {LEVEL_OPTIONS.map((l) => (
              <option key={l.id} value={l.id}>{l.label} — KSh {priceLabel(l.id)}</option>
            ))}
          </select>
        </label>
        <label className="field">Financial year
          <select
            name="fyLabel"
            value={fyLabel}
            required
            onChange={(e) => setFyLabel(e.target.value)}
          >
            <option value="">Choose the year…</option>
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
        {chosen ? (
          <>
            <span style={{ fontFamily: "var(--font-heading)", fontSize: "1.6rem", fontWeight: 700 }}>
              KSh {formatKes(testAmountCents ?? LEVEL_PRICE[level])}
            </span>
            {testAmountCents !== null && (
              <span style={{ color: "var(--alarm)", fontSize: ".85rem" }}>
                test amount — the list price is KSh {formatKes(LEVEL_PRICE[level])}
              </span>
            )}
          </>
        ) : (
          <span className="note">Choose the level and the year to see the price.</span>
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {/* Held shut until both are chosen: the amount is only meaningful once
          the level is, and there is nothing sensible to charge for before then. */}
      <button type="submit" className="btn btn-gold" disabled={pending || !chosen}>
        {pending
          ? "Sending the request…"
          : chosen
            ? `Send M-Pesa request for ${level} ${fyLabel}`
            : "Choose the level and year first"}
      </button>

      <p className="note">
        A prompt comes to that phone. Enter the M-Pesa PIN on the handset to complete the payment.
        One payment covers every account that school keeps at that level, for the whole year.
      </p>
    </form>
  );
}
