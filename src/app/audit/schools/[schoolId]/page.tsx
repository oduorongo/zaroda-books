import Link from "next/link";
import { auditedSchool, latestHandover, reportsOn, sentYears } from "@/server/audit-reports";
import { createClearance, createIpsasReport, createPrimary } from "../../reports/actions";

const KIND_LABEL = { ipsas: "IPSAS internal audit report", primary: "Audited financial statements", clearance: "Clearance memo" };

export default async function AuditSchoolPage({ params, searchParams }: {
  params: Promise<{ schoolId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { schoolId } = await params;
  const { error } = await searchParams;
  const { user, school, sent } = await auditedSchool(schoolId);
  const [years, reports, handover] = await Promise.all([
    sentYears(sent.map((a) => a.id)), reportsOn(schoolId, user.id), latestHandover(schoolId),
  ]);

  return (
    <div className="wrap" style={{ padding: "2.5rem 2.5rem 5rem", maxWidth: 900 }}>
      <Link href="/audit">← All schools</Link>
      <h1 style={{ marginTop: "1rem" }}>{school.name}</h1>
      <p className="sub">
        Books sent to you: {sent.map((a) => a.name).join(", ")}. Reports draw their figures from these
        books only; you write the findings.
      </p>

      <div className="card" style={{ marginBottom: "1.35rem" }}>
        <h2 style={{ marginTop: 0 }}>New IPSAS internal audit report</h2>
        <form action={createIpsasReport}>
          <input type="hidden" name="schoolId" value={schoolId} />
          <p className="note">Tick the financial years the report covers.</p>
          <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", margin: ".75rem 0 1rem" }}>
            {years.map((y) => (
              <label key={y} style={{ display: "flex", gap: ".4rem", alignItems: "center" }}>
                <input type="checkbox" name="year" value={y} /> {y}
              </label>
            ))}
          </div>
          {error === "years" && <p className="error">Tick at least one year.</p>}
          <button type="submit" className="btn btn-primary">Start report</button>
        </form>
      </div>

      <div className="card" style={{ marginBottom: "1.35rem" }}>
        <h2 style={{ marginTop: 0 }}>New audited financial statements</h2>
        <p className="note">The primary school format: one set of statements per account, for the period you set.</p>
        <form action={createPrimary} style={{ marginTop: ".75rem" }}>
          <input type="hidden" name="schoolId" value={schoolId} />
          <div className="grid-3" style={{ alignItems: "end" }}>
            <label className="field">From
              <input name="from" type="date" required />
            </label>
            <label className="field">To
              <input name="to" type="date" required />
            </label>
            <button type="submit" className="btn btn-primary">Start statements</button>
          </div>
          {error === "period" && <p className="error">Set a period whose start is on or before its end.</p>}
        </form>
      </div>

      <div className="card" style={{ marginBottom: "1.35rem" }}>
        <h2 style={{ marginTop: 0 }}>New clearance memo</h2>
        <p className="note">
          {handover
            ? `The school recorded a handover: ${handover.officer} (TSC ${handover.tscNo}), ${handover.reason}, on ${handover.handoverDate}. The memo starts from these details.`
            : "For a head of institution leaving the school: retiring, on transfer, promoted or resigning. The school has not recorded a handover, so you enter the details."}
        </p>
        <form action={createClearance} style={{ marginTop: ".75rem" }}>
          <input type="hidden" name="schoolId" value={schoolId} />
          <button type="submit" className="btn btn-primary">Start memo</button>
        </form>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>Your reports on this school</h2>
        {reports.length === 0 && <p className="note">None yet.</p>}
        <table>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/audit/reports/${r.id}`}>{KIND_LABEL[r.kind]}</Link></td>
                <td>{r.years ? JSON.parse(r.years).join(", ") : r.kind === "primary" ? `${r.periodFrom} to ${r.periodTo}` : r.periodTo ? `up to ${r.periodTo}` : ""}</td>
                <td style={r.status === "draft" ? { color: "var(--alarm)" } : undefined}>
                  {r.status === "draft" ? "Draft" : `Issued ${r.issuedAt?.toLocaleDateString("en-KE")}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
