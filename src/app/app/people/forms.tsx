"use client";

import { useActionState, useState } from "react";
import { ROLES, ROLE_DESCRIPTION, ROLE_LABEL, type Role } from "@/domain";
import { changeRoleAction, inviteAction, removeAction, revokeInviteAction } from "./actions";

/** Owner is granted by promoting an existing member, never by invitation. */
const INVITABLE: Role[] = ROLES.filter((r) => r !== "owner");

export function InviteForm({ origin, schools }: {
  origin: string;
  schools: { id: string; name: string }[];
}) {
  const [result, action, pending] = useActionState(inviteAction, null);
  const [role, setRole] = useState<Role>("bursar");
  const code = result?.startsWith("CODE:") ? result.slice(5) : null;
  const error = result && !code ? result : null;

  return (
    <div className="stack" style={{ maxWidth: 620 }}>
      <form action={action} className="stack">
        <div className="grid-2">
          <label className="field">Their email
            <input name="email" type="email" placeholder="bursar@school.ac.ke" required />
          </label>
          <label className="field">Role
            <select name="role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {INVITABLE.map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="field">Which books
          <select name="schoolId" defaultValue="">
            <option value="">Every school on these books</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name} only</option>)}
          </select>
          <span className="note">
            Tie someone to one school and they reach that school and no other. Leave it on
            every school for your own staff.
          </span>
        </label>
        <p className="note" style={{ margin: 0 }}>{ROLE_DESCRIPTION[role]}</p>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-quiet" disabled={pending} style={{ alignSelf: "flex-start" }}>
          {pending ? "Creating…" : "Create the invitation"}
        </button>
      </form>

      {code && (
        <div className="card" style={{ background: "var(--band)" }}>
          <div className="eyebrow" style={{ color: "var(--gold)" }}>Send them this link</div>
          <p className="note" style={{ margin: ".4rem 0 .6rem" }}>
            We do not email it yet, so send it yourself — WhatsApp is fine. It works once and
            lapses after 14 days. Anyone holding it can join these books, so do not post it
            anywhere public.
          </p>
          <code className="mono" style={{ display: "block", wordBreak: "break-all", fontSize: ".8rem", background: "var(--card)", border: "1px solid var(--rule)", padding: ".7rem .8rem", borderRadius: 3 }}>
            {origin}/join/{code}
          </code>
        </div>
      )}
    </div>
  );
}

export function RoleSelect({ userId, role }: { userId: string; role: Role }) {
  const [error, action, pending] = useActionState(changeRoleAction, null);
  return (
    <form action={action} style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
      <input type="hidden" name="userId" value={userId} />
      <select name="role" defaultValue={role} style={{ padding: ".35rem .45rem", fontSize: ".8rem" }}>
        {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
      </select>
      <button type="submit" className="btn-link" style={{ fontSize: ".82rem" }} disabled={pending}>
        {pending ? "Saving…" : "Set"}
      </button>
      {error && <span className="error"> {error}</span>}
    </form>
  );
}

export function RemoveButton({ userId, name }: { userId: string; name: string }) {
  const [error, action, pending] = useActionState(removeAction, null);
  const [sure, setSure] = useState(false);

  if (!sure) {
    return (
      <button type="button" className="btn-link" style={{ fontSize: ".82rem" }} onClick={() => setSure(true)}>
        Remove
      </button>
    );
  }
  return (
    <form action={action} style={{ display: "flex", gap: ".5rem", alignItems: "center" }}>
      <input type="hidden" name="userId" value={userId} />
      <span className="note">Remove {name}?</span>
      <button type="submit" className="btn-link" style={{ fontSize: ".82rem", color: "var(--alarm)" }} disabled={pending}>
        Yes
      </button>
      <button type="button" className="btn-link" style={{ fontSize: ".82rem" }} onClick={() => setSure(false)}>
        No
      </button>
      {error && <span className="error"> {error}</span>}
    </form>
  );
}

export function RevokeInviteButton({ invitationId }: { invitationId: string }) {
  const [error, action, pending] = useActionState(revokeInviteAction, null);
  return (
    <form action={action} style={{ display: "inline" }}>
      <input type="hidden" name="invitationId" value={invitationId} />
      <button type="submit" className="btn-link" style={{ fontSize: ".82rem" }} disabled={pending}>
        {pending ? "Cancelling…" : "Cancel"}
      </button>
      {error && <span className="error"> {error}</span>}
    </form>
  );
}
