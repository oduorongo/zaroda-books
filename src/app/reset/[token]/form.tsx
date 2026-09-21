"use client";

import { useActionState } from "react";
import { PasswordField } from "@/app/password-field";
import { MIN_PASSWORD } from "@/domain";
import { resetAction } from "./actions";

export function ResetForm({ token }: { token: string }) {
  const [error, action, pending] = useActionState(resetAction, null);

  return (
    <form action={action} className="stack">
      <input type="hidden" name="token" value={token} />
      <PasswordField
        label="New password"
        name="password"
        autoComplete="new-password"
        placeholder={`At least ${MIN_PASSWORD} characters`}
        minLength={MIN_PASSWORD}
      />
      <PasswordField label="Type it again" name="again" autoComplete="new-password" />
      {error && <p className="error">{error}</p>}
      <button type="submit" className="btn btn-gold" disabled={pending}>
        {pending ? "Saving…" : "Set the new password"}
      </button>
    </form>
  );
}
