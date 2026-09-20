"use client";

import { useActionState, useState } from "react";
import { LEVEL_OPTIONS } from "@/domain";
import {
  createSubscriptionAction, setApprovedAction, setPaidAction, unbindAction,
} from "./actions";

export function PaidToggle({ orgId, subscriptionId, paid }: {
  orgId: string; subscriptionId: string; paid: boolean;
}) {
  const [error, action, pending] = useActionState(setPaidAction, null);
  return (
    <form action={action} style={{ display: "inline" }}>
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="subscriptionId" value={subscriptionId} />
      <input type="hidden" name="paid" value={paid ? "no" : "yes"} />
      <button type="submit" className="btn-link" style={{ fontSize: ".82rem" }} disabled={pending}>
        {paid ? "Mark unpaid" : "Mark paid"}
      </button>
      {error && <span className="error"> {error}</span>}
    </form>
  );
}

/**
 * Unbinding is the one thing here that weakens a rule rather than records one,
 * so it stays folded away and will not submit without a sentence of reason.
 */
export function UnbindForm({ orgId, subscriptionId, schoolName }: {
  orgId: string; subscriptionId: string; schoolName: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, action, pending] = useActionState(unbindAction, null);

  if (!open) {
    return (
      <button type="button" className="btn-link" style={{ fontSize: ".82rem" }} onClick={() => setOpen(true)}>
        Release binding
      </button>
    );
  }

  return (
    <form action={action} className="stack" style={{ gap: ".6rem", marginTop: ".5rem" }}>
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="subscriptionId" value={subscriptionId} />
      <p className="note" style={{ margin: 0 }}>
        This frees the subscription from <strong>{schoolName}</strong>, so it can be used by a
        different school. Do this only for a binding made in error.
      </p>
      <textarea name="reason" rows={2} required placeholder="Why this binding is being released" />
      {error && <p className="error">{error}</p>}
      <div style={{ display: "flex", gap: ".6rem" }}>
        <button type="submit" className="btn btn-quiet" disabled={pending}>
          {pending ? "Releasing…" : "Release"}
        </button>
        <button type="button" className="btn-link" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

export function NewSubscriptionForm({ orgId, years }: { orgId: string; years: string[] }) {
  const [error, action, pending] = useActionState(createSubscriptionAction, null);
  return (
    <form action={action} style={{ display: "flex", gap: ".6rem", alignItems: "flex-end", flexWrap: "wrap" }}>
      <input type="hidden" name="orgId" value={orgId} />
      <label className="field">Level
        <select name="level" defaultValue="primary">
          {LEVEL_OPTIONS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
      </label>
      <label className="field">Financial year
        <select name="fyLabel">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: ".4rem", paddingBottom: ".7rem" }}>
        <input type="checkbox" name="paid" value="yes" defaultChecked style={{ width: "auto" }} />
        Already paid
      </label>
      <button type="submit" className="btn btn-quiet" disabled={pending}>
        {pending ? "Adding…" : "Add subscription"}
      </button>
      {error && <p className="error" style={{ width: "100%" }}>{error}</p>}
    </form>
  );
}

export function ApproveButton({ orgId, approved }: { orgId: string; approved: boolean }) {
  const [error, action, pending] = useActionState(setApprovedAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="approved" value={approved ? "no" : "yes"} />
      <button type="submit" className={approved ? "btn btn-quiet" : "btn btn-gold"} disabled={pending}>
        {approved ? "Hold this account" : "Approve, release the free school"}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
