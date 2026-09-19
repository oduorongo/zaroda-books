"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthLayout } from "../auth-layout";
import { CountyPicker } from "../county-picker";
import { signup } from "./actions";

export default function SignupPage() {
  const [error, action, pending] = useActionState(signup, null);

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Free for the first school. No card required."
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
        <label className="field">Password
          <input name="password" type="password" placeholder="At least 10 characters" autoComplete="new-password" required />
        </label>
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
