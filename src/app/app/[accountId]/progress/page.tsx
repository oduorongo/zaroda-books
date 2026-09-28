import Link from "next/link";
import { STEP_LABEL, can, describeAuditScope, type StepState } from "@/domain";
import { bookProgress } from "@/server/book-progress";
import { monthName } from "@/server/periods";

const day = (d: Date | null | undefined) =>
  d ? d.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "";

const vrs = (list: string[]) => list.length > 12 ? `${list.slice(0, 12).join(", ")} and ${list.length - 12} more` : list.join(", ");

function Chip({ state, text }: { state: StepState | "alarm"; text?: string }) {
  return <span className={`step-chip step-${state}`}>{text ?? STEP_LABEL[state as StepState]}</span>;
}

function Step({ no, title, state, chip, children }: {
  no: number; title: string; state: StepState | "alarm"; chip?: string; children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "1rem", flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}><span className="mono note" style={{ marginRight: ".5rem" }}>{String(no).padStart(2, "0")}</span>{title}</h2>
        <Chip state={state} text={chip} />
      </div>
      <div style={{ marginTop: ".7rem", lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

/**
 * Where the book stands on its way to audit, stage by stage, with what is
 * still outstanding and where to see to it. Read-only: the work itself is
 * done on the pages it links to.
 */
export default async function ProgressPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const p = await bookProgress(accountId);
  const { user, fy, school, account, audit, payments } = p;
  const base = `/app/${accountId}`;
  const seesReports = can(user.role, "book.sendForAudit");

  const statementRequired = p.withoutStatement.includes(p.months.at(-1)?.month.slice(0, 7) ?? "");
  const evidence: StepState = p.entries === 0 ? "todo"
    : payments.withoutDocuments.length || p.withoutStatement.length || p.scde.length ? "doing" : "done";
  const approved: StepState = account.authorisationExempt ? "done"
    : payments.total === 0 ? "todo" : payments.authorised === payments.total ? "done" : "doing";
  const closedCount = p.months.filter((m) => m.status === "closed").length;
  const closed: StepState = audit.yearClosed ? "done" : closedCount ? "doing" : "todo";
  const sent: StepState = audit.sentTo ? "done" : audit.yearClosed ? "doing" : "todo";
  const reopens = p.events.filter((e) => e.action === "reopen");
  const audited: StepState = p.stage.key === "audited" ? "done" : audit.sentTo ? "doing" : "todo";

  return (
    <>
      <h1>Book progress</h1>
      <p className="sub">{school.name} — {account.name}, FY {fy.label}.</p>

      <div className="card" style={{ marginBottom: "1.5rem", borderLeft: "3px solid var(--gold)" }}>
        <div className="eyebrow">Where this book stands</div>
        <div style={{ fontSize: "1.2rem", fontWeight: 600, marginTop: ".25rem" }}>{p.stage.label}</div>
      </div>

      <Step no={1} title="Evidence" state={evidence}>
        {payments.total === 0 ? <p className="note" style={{ margin: 0 }}>No payments yet.</p> : (
          <p style={{ margin: 0 }}>
            Supporting documents: {payments.total - payments.withoutDocuments.length} of {payments.total} payments.
            {payments.withoutDocuments.length > 0 && (
              <span className="note"> Without any: VR {vrs(payments.withoutDocuments)}. These only warn — the auditor sees the gap.</span>
            )}{" "}
            <Link href={`${base}/payments`}>Payments →</Link>
          </p>
        )}
        <p style={{ margin: ".5rem 0 0" }}>
          Bank statements: {p.withoutStatement.length === 0 ? "every month covered." : (
            <>none for {p.withoutStatement.map((m) => monthName(`${m}-01`)).join(", ")}.
              {statementRequired && <strong style={{ color: "var(--alarm)" }}> The year&apos;s last month is required before sending for audit.</strong>}</>
          )}{" "}
          <Link href={`${base}/bank-reconciliation`}>Bank reconciliation →</Link>
        </p>
        {p.infrastructure && (
          <p style={{ margin: ".5rem 0 0" }}>
            SCDE approvals: {p.scde.length === 0 ? "every payment's project has one." : (
              <strong style={{ color: "var(--alarm)" }}>
                missing for VR {vrs(p.scde.map((s) => `${s.vrNo} (${s.project ?? "no project named"})`))}.
              </strong>
            )}{" "}
            <Link href={`${base}/projects`}>Projects and SCDE approvals →</Link>
          </p>
        )}
      </Step>

      <Step no={2} title="Approved by the head of institution" state={approved}>
        {account.authorisationExempt ? (
          <p style={{ margin: 0 }}>This book&apos;s payments were authorised on paper before the head&apos;s authorisation was kept here.</p>
        ) : payments.total === 0 ? <p className="note" style={{ margin: 0 }}>No payments yet.</p> : (
          <>
            <p style={{ margin: 0 }}>Authorised: {payments.authorised} of {payments.total} payments.</p>
            {payments.awaiting.length > 0 && <p style={{ margin: ".3rem 0 0" }}>Awaiting the head: VR {vrs(payments.awaiting)}.</p>}
            {payments.changed.length > 0 && <p style={{ margin: ".3rem 0 0" }}>Changed since authorised, to authorise again: VR {vrs(payments.changed)}.</p>}
            {payments.held.length > 0 && <p style={{ margin: ".3rem 0 0", color: "var(--alarm)" }}>Held by the head: VR {vrs(payments.held)}.</p>}
            <p style={{ margin: ".5rem 0 0" }}><Link href={`${base}/payments/authorisation`}>Authorisation →</Link></p>
          </>
        )}
      </Step>

      <Step no={3} title="Closed" state={closed}>
        <p style={{ margin: "0 0 .6rem" }}>
          {closedCount} of {p.months.length} months closed.{" "}
          <Link href={`${base}/bank-reconciliation`}>Close a month on the bank reconciliation →</Link>
        </p>
        <table style={{ maxWidth: 560 }}>
          <tbody>
            {p.months.map((m) => (
              <tr key={m.id}>
                <td>{monthName(m.month)}</td>
                <td>{m.status === "closed" ? "Closed" : <span className="note">Open</span>}</td>
                <td className="note">{m.status === "closed" ? `${day(m.closedAt)}${m.closedByName ? ` · ${m.closedByName}` : ""}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Step>

      <Step no={4} title="Sent to the auditor" state={sent} chip={sent === "doing" ? "Ready to send" : undefined}>
        {audit.sentTo ? (
          <p style={{ margin: 0 }}>
            Sent to <strong>{audit.sentTo.name}</strong> ({describeAuditScope(audit.sentTo.grant)})
            {account.auditUpTo && <> for a handover audit, up to {monthName(`${account.auditUpTo}-01`)}</>}
            {account.auditSentAt && <> on {day(account.auditSentAt)}</>}.
          </p>
        ) : !audit.yearClosed ? (
          <p className="note" style={{ margin: 0 }}>Not sent. The year must be closed up to June first{audit.handover ? `, or up to ${audit.handover.cutoffName} for the handover audit` : ""}.</p>
        ) : audit.blocked ? (
          <p style={{ margin: 0 }}><strong style={{ color: "var(--alarm)" }}>Cannot be sent yet.</strong> {audit.blocked}</p>
        ) : (
          <p style={{ margin: 0 }}>Closed and ready. {audit.warning && <span className="note">{audit.warning}</span>}</p>
        )}
        <p style={{ margin: ".5rem 0 0" }}>
          Audit queries: {p.queries.open} open (the school&apos;s turn), {p.queries.answered} answered (the auditor&apos;s turn), {p.queries.closed} closed.{" "}
          <Link href={`${base}/queries`}>Audit queries →</Link>
          {!audit.sentTo && <>{" · "}<Link href={`${base}/settings`}>Send from Book settings →</Link></>}
        </p>
      </Step>

      <Step no={5} title="Reopened or taken back" state={p.stage.key === "reopened" ? "alarm" : reopens.length ? "done" : "todo"}
        chip={p.stage.key === "reopened" ? "Reopened — close again" : reopens.length ? `${reopens.length} this year` : "None"}>
        {p.events.length === 0 ? <p className="note" style={{ margin: 0 }}>Nothing closed, reopened or sent yet.</p> : (
          <>
            <p className="note" style={{ margin: "0 0 .5rem" }}>
              Only the owner reopens, with a reason. Reopening reopens every closed month and takes the book back from the auditor.
            </p>
            <table>
              <tbody>
                {p.events.map((e, i) => (
                  <tr key={i}>
                    <td className="note" style={{ whiteSpace: "nowrap" }}>{day(e.at)}</td>
                    <td>
                      {e.action === "close" && <>Closed {e.months > 1 ? `${e.months} months, ` : ""}up to {e.month ? monthName(e.month) : "—"}</>}
                      {e.action === "reopen" && <strong>Reopened {e.months > 1 ? `${e.months} months` : e.month ? monthName(e.month) : ""}</strong>}
                      {e.action === "audit.sent" && <>Sent for audit{e.month ? `, handover up to ${monthName(`${e.month}-01`)}` : ""}</>}
                      {e.action === "audit.withdrawn" && <strong style={{ color: "var(--alarm)" }}>Taken back from the auditor</strong>}
                      {e.reason && e.action === "reopen" && <span className="note"> — {e.reason}</span>}
                    </td>
                    <td className="note">{e.by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Step>

      <Step no={6} title="Audited" state={audited} chip={audited === "doing" ? "With the auditor" : undefined}>
        {p.reports.length === 0 ? (
          <p className="note" style={{ margin: 0 }}>No report issued on this book&apos;s year yet.</p>
        ) : p.reports.map((r) => {
          const title = r.kind === "clearance" ? `Clearance memo, for the years up to ${r.periodTo}`
            : r.kind === "primary" ? `Audited financial statements, ${r.periodFrom} to ${r.periodTo}`
            : `IPSAS internal audit report, ${r.years ? (JSON.parse(r.years) as string[]).join(" and ") : ""}`;
          return (
            <p key={r.id} style={{ margin: ".3rem 0" }}>
              {seesReports ? <Link href={`${base}/audit-reports/${r.id}`}>{title}</Link> : title}
              <span className="note"> — issued {day(r.issuedAt)}
                {account.auditSentAt && r.issuedAt && r.issuedAt < account.auditSentAt ? " (before the book was last sent)" : ""}</span>
            </p>
          );
        })}
      </Step>
    </>
  );
}
