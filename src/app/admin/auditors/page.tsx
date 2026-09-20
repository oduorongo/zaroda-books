import Link from "next/link";
import { describeAuditScope } from "@/domain";
import { listAuditors } from "@/server/platform";
import { GrantAuditorForm, RevokeButton } from "./forms";

const day = (d: Date | null) =>
  d ? new Date(d).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default async function AuditorsPage() {
  const auditors = await listAuditors();
  const live = auditors.filter((a) => !a.auditor.revokedAt);

  return (
    <>
      <Link href="/admin" className="back-link">← All tenants</Link>
      <h1>Auditors</h1>
      <p className="sub">
        Ministry internal auditors, each granted one sub-county or one whole county. They read
        every school in their area whoever keeps its books, they can change nothing, and each
        school they open is written to that school&apos;s audit log.
      </p>

      <div className="card" style={{ marginBottom: "1.35rem" }}>
        <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: ".75rem" }}>
          {live.length} live grant{live.length === 1 ? "" : "s"}
        </div>
        <table>
          <thead>
            <tr><th>Auditor</th><th>Area</th><th>Granted</th><th>State</th><th></th></tr>
          </thead>
          <tbody>
            {auditors.map((a) => (
              <tr key={a.auditor.id}>
                <td>{a.name}<div className="note">{a.email}</div></td>
                <td>{describeAuditScope(a.auditor)}</td>
                <td>{day(a.auditor.grantedAt)}</td>
                <td style={{ color: a.auditor.revokedAt ? "var(--muted)" : "var(--gold)" }}>
                  {a.auditor.revokedAt ? `withdrawn ${day(a.auditor.revokedAt)}` : "live"}
                </td>
                <td>{!a.auditor.revokedAt && <RevokeButton auditorId={a.auditor.id} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {auditors.length === 0 && <p className="note">No audit has been granted.</p>}
      </div>

      <div className="card">
        <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: ".75rem" }}>
          Grant an audit
        </div>
        <GrantAuditorForm />
      </div>
    </>
  );
}
