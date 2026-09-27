"use client";

import { useActionState, useState } from "react";
import { AUTH_ROUTES, AUTH_ROUTE_LABEL, type AuthRoute } from "@/domain";
import { saveAuthorisationAction } from "./actions";

/** How the head of institution authorises this school's payments, and who the head is. */
export function AuthorisationForm({ accountId, current, emailReady, canEdit }: {
  accountId: string;
  current: { authRoute: AuthRoute | null; hoiName: string | null; hoiTsc: string | null; hoiEmail: string | null };
  emailReady: boolean;
  canEdit: boolean;
}) {
  const [message, action, pending] = useActionState(saveAuthorisationAction, null);
  const [route, setRoute] = useState<AuthRoute | "">(current.authRoute ?? "");

  return (
    <form action={action} className="card" style={{ maxWidth: 720, marginBottom: "1.6rem" }}>
      <input type="hidden" name="accountId" value={accountId} />
      <p className="note" style={{ marginTop: 0, lineHeight: 1.6 }}>
        The head of institution authorises every payment; whoever keeps the books cannot do it for them.
        Every change here is recorded and shown to the auditor.
      </p>
      <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0 }}>
        <div style={{ display: "grid", gap: ".45rem", marginBottom: "1rem" }}>
          {AUTH_ROUTES.map((r) => (
            <label key={r} style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
              <input
                type="radio" name="route" value={r} checked={route === r}
                disabled={r === "email" && !emailReady}
                onChange={() => setRoute(r)}
              />
              {AUTH_ROUTE_LABEL[r]}
              {r === "email" && !emailReady && <span className="note">— email is not set up yet</span>}
              {r === "login" && <span className="note">— invite them from People as Authoriser, for this school</span>}
            </label>
          ))}
        </div>
        <div className="grid-2">
          <label className="field">Head of institution
            <input name="hoiName" defaultValue={current.hoiName ?? ""} required />
          </label>
          <label className="field">TSC number
            <input name="hoiTsc" defaultValue={current.hoiTsc ?? ""} />
          </label>
          {route === "email" ? (
            <label className="field">Head&apos;s own email
              <input name="hoiEmail" type="email" defaultValue={current.hoiEmail ?? ""} required />
            </label>
          ) : <input type="hidden" name="hoiEmail" value={current.hoiEmail ?? ""} />}
        </div>
        {canEdit && (
          <button type="submit" className="btn btn-primary" disabled={pending || !route}>
            {pending ? "Saving…" : "Save"}
          </button>
        )}
      </fieldset>
      {!canEdit && <p className="note">Only the owner of these books changes this.</p>}
      {message && <p className={message === "Saved." ? "verdict ok" : "error"}>{message}</p>}
    </form>
  );
}
