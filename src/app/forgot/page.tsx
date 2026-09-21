"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthLayout } from "../auth-layout";
import { forgotAction } from "./actions";

export default function ForgotPage() {
  const [result, action, pending] = useActionState(forgotAction, null);
  const sent = result === "SENT";

  return (
    <AuthLayout
      title="Forgotten password"
      subtitle="We will email you a link to set a new one."
      aside="Your books are where you left them."
    >
      {sent ? (
        <div className="stack">
          <p style={{ lineHeight: 1.6, margin: 0 }}>
            If that address has an account, a link is on its way. It works once and lapses
            after an hour.
          </p>
          <p className="note" style={{ margin: 0 }}>
            Nothing arrived? Check the spam folder, then try again. If it still does not come,
            reach us on <a href="https://wa.me/254781230805">WhatsApp 0781 230 805</a>.
          </p>
          <p className="note"><Link href="/login">Back to log in</Link></p>
        </div>
      ) : (
        <form action={action} className="stack">
          <label className="field">Email address
            <input name="email" type="email" placeholder="you@school.ac.ke" autoComplete="email" required />
          </label>
          {result && result !== "SENT" && <p className="error">{result}</p>}
          <button type="submit" className="btn btn-gold" disabled={pending}>
            {pending ? "Sending…" : "Send the link"}
          </button>
          <p className="note"><Link href="/login">Back to log in</Link></p>
        </form>
      )}
    </AuthLayout>
  );
}
