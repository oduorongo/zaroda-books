"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthLayout } from "../auth-layout";
import { PasswordField } from "../password-field";
import { CountyPicker } from "../county-picker";
import { signup } from "./actions";

export default function SignupPage() {
  const [error, action, pending] = useActionState(signup, null);

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Your first school is free — one school level, for one financial year."
      aside="Set up a school once. Keep its books for years."
    >
      <form action={action} className="stack">
        <div className="grid-2">
          <label className="field">Full name
            <input name="name" placeholder="Jane Ochieng" autoComplete="name" required />
          </label>
          <label className="field">Practice or school group
            <input name="practice" placeholder="Ochieng &amp; Associates" />
          </label>
        </div>
        <CountyPicker required />
        <label className="field">Email address
          <input name="email" type="email" placeholder="you@school.ac.ke" autoComplete="email" required />
        </label>
        <PasswordField
          label="Password"
          name="password"
          autoComplete="new-password"
          placeholder="At least 10 characters"
          minLength={10}
        />
        {/* Said plainly here, because the alternative is a bursar discovering
            the limit at the moment they are refused a second book. */}
        <div className="card" style={{ padding: "1rem 1.1rem", background: "var(--band)" }}>
          <div className="eyebrow" style={{ color: "var(--gold)" }}>What the free school covers</div>
          <p className="note" style={{ margin: ".45rem 0 0", lineHeight: 1.6 }}>
            One school at one level — primary, junior or senior — for one financial year,
            with every account that level keeps: tuition, operations, infrastructure, boarding
            and lunch. A second school, another level, or a later year is subscribed for.
          </p>
        </div>

        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-gold" disabled={pending}>
          {pending ? "Creating…" : "Create account"}
        </button>
        <p className="note">
          Already have an account? <Link href="/login">Log in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
