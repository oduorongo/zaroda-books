"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthLayout } from "../auth-layout";
import { PasswordField } from "../password-field";
import { login } from "./actions";

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null);

  return (
    <AuthLayout
      title="Log in"
      subtitle="Welcome back."
      aside="Your books are where you left them."
    >
      <form action={action} className="stack">
        <label className="field">Email address
          <input name="email" type="email" placeholder="you@school.ac.ke" autoComplete="email" required />
        </label>
        <PasswordField label="Password" name="password" autoComplete="current-password" />
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-gold" disabled={pending}>
          {pending ? "Logging in…" : "Log in"}
        </button>
        <p className="note">
          <Link href="/forgot">Forgotten your password?</Link>
        </p>
        <p className="note">
          No account yet? <Link href="/signup">Create one</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
