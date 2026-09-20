"use client";

import { useState } from "react";

/**
 * A password box that can be read back. Typing a password blind on a phone
 * keyboard is where most failed logins come from, and a ten-character minimum
 * makes that worse.
 *
 * It starts hidden and says so, so revealing is always a deliberate act —
 * these forms get filled in staffrooms and bursars' offices with people about.
 */
export function PasswordField({
  label, name, autoComplete, placeholder, minLength,
}: {
  label: string;
  name: string;
  autoComplete: string;
  placeholder?: string;
  minLength?: number;
}) {
  const [shown, setShown] = useState(false);

  return (
    <label className="field">
      <span style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem" }}>
        {label}
        <button
          type="button"
          className="btn-link"
          style={{ fontSize: ".78rem", fontWeight: 400 }}
          onClick={() => setShown((s) => !s)}
          // Announced, because the icon-free wording is the only cue a screen
          // reader gets that the password is now on screen.
          aria-pressed={shown}
        >
          {shown ? "Hide" : "Show"}
        </button>
      </span>
      <input
        name={name}
        type={shown ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        minLength={minLength}
        required
      />
    </label>
  );
}
