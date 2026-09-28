import Link from "next/link";
import { AUTH_ROUTE_LABEL, authorisationLine, formatKes, projectKey, takesProject, type AccountType } from "@/domain";
import { documentsFor, schoolProjects } from "@/server/documents";
import { loadBook } from "@/server/book-context";
import { getTxns } from "@/server/queries";
import { paymentStatuses, requestsFor, settingsHistory } from "@/server/authorisation";
import { ReportShell } from "../../report-shell";

const day = (d: Date) => d.toISOString().slice(0, 10);

/**
 * How every payment of the year was authorised, and every change to who the
 * head is and how they are reached. Written for the auditor: the address a
 * code went to is only as good as the history of who set it.
 */
export default async function AuthorisationRegisterPage({ params }: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const { fy, school, account } = await loadBook(accountId);
  const [statuses, history, requests] = await Promise.all([
    getTxns(fy.id).then(paymentStatuses),
    settingsHistory(school.id),
    requestsFor(accountId),
  ]);
  const authorised = statuses.filter((s) => s.status.state === "authorised").length;
  const infrastructure = takesProject(account.type as AccountType);
  const [docs, projects] = await Promise.all([
    documentsFor(statuses.map((s) => s.payment.id)),
    infrastructure ? schoolProjects(school.id) : [],
  ]);
  const undocumented = statuses.filter((s) => !docs.has(s.payment.id));
  const approved = new Set(projects.filter((p) => p.letter).map((p) => p.key));

  return (
    <ReportShell
      title="Authorisation register"
      sub={<>How the head of institution authorised each payment. {authorised} of {statuses.length} authorised as they now stand.</>}
      school={school.name} level={school.level} account={account.name} fyLabel={fy.label}
      landscape
    >
      <p style={{ margin: "0 0 1.2rem" }}>
        {school.authRoute
          ? <>{AUTH_ROUTE_LABEL[school.authRoute]}. Head of institution: {school.hoiName}
              {school.hoiTsc ? `, TSC ${school.hoiTsc}` : ""}{school.authRoute === "email" ? `, ${school.hoiEmail}` : ""}.</>
          : <span className="note">No route chosen yet. <Link href={`/app/${accountId}/settings`}>Choose one in Book settings</Link>.</span>}
      </p>

      {account.authorisationExempt && (
        <p className="note" style={{ margin: "0 0 1.2rem" }}>
          This book was sent for audit before Zaroda Books kept the head&apos;s authorisation, so it is exempt:
          its payments were authorised on the signed vouchers.
        </p>
      )}

      <table>
        <thead><tr><th>VR</th><th>Date</th><th>Paid to</th><th className="n">Amount</th><th>Authorisation</th></tr></thead>
        <tbody>
          {statuses.map(({ payment: p, status: s }) => (
            <tr key={p.id}>
              <td className="mono">{p.vrNo ?? "—"}</td>
              <td className="mono">{p.date}</td>
              <td>{p.particulars}</td>
              <td className="n">{formatKes(p.cash + p.bank)}</td>
              <td>
                {s.state === "authorised" ? authorisationLine(s.record)
                  : s.state === "held" ? <span className="error">Held back: {s.reason}</span>
                  : s.state === "changed" ? <span className="error">Amended after it was authorised. Not authorised as it stands.</span>
                  : <span className="error">Not authorised</span>}
              </td>
            </tr>
          ))}
          {statuses.length === 0 && <tr><td colSpan={5} className="note">No payments yet.</td></tr>}
        </tbody>
      </table>

      <h2>Payments with no supporting documents</h2>
      {undocumented.length === 0 ? <p className="note">Every payment has a document attached or noted as on the paper file.</p> : (
        <p>{undocumented.map((s) => `VR ${s.payment.vrNo ?? "—"}`).join(", ")}</p>
      )}

      {infrastructure && (
        <>
          <h2>SCDE approval of projects</h2>
          <table>
            <thead><tr><th>VR</th><th>Paid to</th><th>Project</th><th>SCDE approval</th></tr></thead>
            <tbody>
              {statuses.map(({ payment: p }) => (
                <tr key={p.id}>
                  <td className="mono">{p.vrNo ?? "—"}</td>
                  <td>{p.particulars}</td>
                  <td>{p.project ?? <span className="error">No project named</span>}</td>
                  <td>{p.project && approved.has(projectKey(p.project)) ? "Attached" : <span className="error">Not attached</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note"><Link href={`/app/${accountId}/projects`}>Projects and SCDE approvals →</Link></p>
        </>
      )}

      <h2>Changes to how the head authorises</h2>
      <table>
        <thead><tr><th>Date</th><th>By</th><th>Route</th><th>Head of institution</th><th>Email</th></tr></thead>
        <tbody>
          {history.map((h, i) => (
            <tr key={i}>
              <td className="mono">{day(h.at)}</td>
              <td>{h.by}</td>
              <td>{AUTH_ROUTE_LABEL[h.after.authRoute]}</td>
              <td>{h.after.hoiName}{h.after.hoiTsc ? `, TSC ${h.after.hoiTsc}` : ""}</td>
              <td>{h.after.hoiEmail ?? "—"}</td>
            </tr>
          ))}
          {history.length === 0 && <tr><td colSpan={5} className="note">None recorded.</td></tr>}
        </tbody>
      </table>

      <h2>Lists put to the head</h2>
      <table>
        <thead><tr><th>Prepared</th><th>How</th><th className="n">Payments</th><th>Outcome</th></tr></thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id}>
              <td className="mono">{day(r.createdAt)}</td>
              <td>
                {r.route === "email" ? `Emailed to ${r.sentTo}` : (
                  <Link href={`/app/${accountId}/payments/authorisation/${r.id}`}>
                    Paper schedule, ref. {r.id.slice(0, 8).toUpperCase()}
                  </Link>
                )}
              </td>
              <td className="n">{JSON.parse(r.payments).length}</td>
              <td>
                {r.completedAt
                  ? r.route === "paper" ? `Signed ${r.signedOn}` : `Decided ${day(r.completedAt)}`
                  : r.expiresAt < new Date() ? "Lapsed unanswered" : "Awaiting the head"}
              </td>
            </tr>
          ))}
          {requests.length === 0 && <tr><td colSpan={4} className="note">None yet.</td></tr>}
        </tbody>
      </table>
    </ReportShell>
  );
}
