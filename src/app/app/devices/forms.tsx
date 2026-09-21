"use client";

import { useActionState } from "react";
import { signOutDeviceAction, signOutOthersAction } from "./actions";

export function SignOutDevice({ sessionId }: { sessionId: string }) {
  const [error, action, pending] = useActionState(signOutDeviceAction, null);
  return (
    <form action={action} style={{ display: "inline" }}>
      <input type="hidden" name="sessionId" value={sessionId} />
      <button type="submit" className="btn-link" style={{ fontSize: ".82rem" }} disabled={pending}>
        {pending ? "Signing out…" : "Sign out"}
      </button>
      {error && <span className="error"> {error}</span>}
    </form>
  );
}

export function SignOutOthers() {
  return (
    <form action={signOutOthersAction}>
      <button type="submit" className="btn btn-quiet">Sign out every other device</button>
    </form>
  );
}
