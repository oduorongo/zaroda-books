"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthRoute } from "@/domain";
import { DecisionTable, type DecisionRow } from "../../../decision-table";
import { authoriseAction, preparePaperAction, sendToHoiAction } from "./actions";

/**
 * Where the head of institution stands on this book's payments. The head
 * signed in sees the list to decide; whoever keeps the books sees how to put
 * it to the head, by the route the school chose.
 */
export function AuthorisationPanel(p: {
  accountId: string;
  counts: { authorised: number; pending: number; held: number };
  pending: DecisionRow[];
  held: { vrNo?: string; payee: string; reason: string }[];
  iAuthorise: boolean;
  iPost: boolean;
  route: AuthRoute | null;
  hoi: { name: string | null; email: string | null };
  openSchedules: { id: string; printed: string; count: number }[];
}) {
  const { accountId, counts } = p;

  return (
    <div className="card no-print" style={{ marginBottom: "1.6rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "baseline" }}>
        <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Authorisation by the head of institution</h2>
        <Link className="note" href={`/app/${accountId}/payments/authorisation`}>Authorisation register →</Link>
      </div>
      <p className="note" style={{ margin: ".5rem 0 1rem" }}>
        {counts.authorised} authorised · {counts.pending} awaiting the head · {counts.held} held back
      </p>

      {p.held.length > 0 && (
        <div style={{ marginBottom: "1rem" }}>
          {p.held.map((h, i) => (
            <p key={i} className="error" style={{ margin: ".2rem 0" }}>
              VR {h.vrNo ?? "—"}, {h.payee}: held back — {h.reason}
            </p>
          ))}
          {p.iPost && <p className="note">Amend a held payment and it goes back to the head.</p>}
        </div>
      )}

      {p.pending.length === 0 ? null : p.iAuthorise ? (
        <Decide accountId={accountId} rows={p.pending} />
      ) : p.iPost ? (
        p.route === "email" ? (
          <SendByEmail accountId={accountId} count={p.pending.length} hoi={p.hoi} />
        ) : p.route === "paper" ? (
          <PrintSchedule accountId={accountId} count={p.pending.length} open={p.openSchedules} />
        ) : p.route === "login" ? (
          <p className="note" style={{ margin: 0 }}>
            {p.hoi.name ?? "The head"} signs in as Authoriser to authorise them.
            Not invited yet? <Link href="/app/people">Invite them from People</Link>, for this school.
          </p>
        ) : (
          <p className="note" style={{ margin: 0 }}>
            Choose how the head authorises payments in <Link href={`/app/${accountId}/settings`}>Book settings</Link>.
          </p>
        )
      ) : null}
    </div>
  );
}

function Decide({ accountId, rows }: { accountId: string; rows: DecisionRow[] }) {
  const [error, action, pending] = useActionState(authoriseAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="accountId" value={accountId} />
      <DecisionTable rows={rows} />
      <button type="submit" className="btn btn-primary" disabled={pending} style={{ marginTop: "1rem" }}>
        {pending ? "Saving…" : "Authorise the ticked payments"}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

function SendByEmail({ accountId, count, hoi }: {
  accountId: string; count: number; hoi: { name: string | null; email: string | null };
}) {
  const [message, action, pending] = useActionState(sendToHoiAction, null);
  return (
    <form action={action}>
      <input type="hidden" name="accountId" value={accountId} />
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Sending…" : `Email ${count} payment${count === 1 ? "" : "s"} to ${hoi.name ?? "the head"}`}
      </button>
      <span className="note" style={{ marginLeft: ".75rem" }}>to {hoi.email}</span>
      {message && <p className={message.startsWith("Sent.") ? "verdict ok" : "error"}>{message}</p>}
    </form>
  );
}

function PrintSchedule({ accountId, count, open }: {
  accountId: string; count: number; open: { id: string; printed: string; count: number }[];
}) {
  const [error, action, pending] = useActionState(preparePaperAction, null);
  return (
    <>
      <form action={action}>
        <input type="hidden" name="accountId" value={accountId} />
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Preparing…" : `Print a schedule of ${count} payment${count === 1 ? "" : "s"} for the head to sign`}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
      {open.length > 0 && (
        <div style={{ marginTop: "1rem" }}>
          <div className="note">Schedules printed and not yet recorded as signed:</div>
          {open.map((s) => (
            <p key={s.id} style={{ margin: ".3rem 0" }}>
              <Link href={`/app/${accountId}/payments/authorisation/${s.id}`}>
                Printed {s.printed}, {s.count} payment{s.count === 1 ? "" : "s"} — record the signature
              </Link>
            </p>
          ))}
        </div>
      )}
    </>
  );
}
