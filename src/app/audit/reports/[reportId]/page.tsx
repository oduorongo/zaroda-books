import Link from "next/link";
import { myReport, parseContent, reportFigures } from "@/server/audit-reports";
import { PrintButton } from "../../../app/[accountId]/print-button";
import { IpsasReport } from "../../ipsas-report";
import { deleteDraft, issueReport, saveIpsasContent } from "../actions";

function Area({ name, label, value, rows = 4, hint }: {
  name: string; label: string; value: string; rows?: number; hint?: string;
}) {
  return (
    <label className="field" style={{ marginBottom: "1rem" }}>{label}
      <textarea name={name} defaultValue={value} rows={rows} style={{ width: "100%" }} />
      {hint && <span className="note">{hint}</span>}
    </label>
  );
}

const BLANK_ROWS = 3;

export default async function AuditReportPage({ params, searchParams }: {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { reportId } = await params;
  const { saved } = await searchParams;
  const { user, report } = await myReport(reportId);
  const content = parseContent(report.content);
  const data = await reportFigures(report, user.name);
  const draft = report.status === "draft";
  const years: string[] = JSON.parse(report.years ?? "[]");
  const recs = [...content.recommendations, ...Array.from({ length: BLANK_ROWS }, () => ({ issue: "", comments: "", who: "", timeframe: "" }))];

  return (
    <div className="wrap" style={{ padding: "2.5rem 2.5rem 5rem", maxWidth: 1000 }}>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <Link href={`/audit/schools/${report.schoolId}`}>← {data.school}</Link>
        <PrintButton />
      </div>

      {draft && (
        <div className="no-print">
          <form action={saveIpsasContent} className="card" style={{ marginBottom: "1.35rem" }}>
            <input type="hidden" name="reportId" value={report.id} />
            <h2 style={{ marginTop: 0 }}>What you write</h2>
            <p className="note" style={{ marginBottom: "1rem" }}>
              Every figure comes from the books and cannot be typed. Put each point on its own line.
            </p>
            <Area name="summary" label="Executive summary" value={content.summary} rows={6} />
            <Area name="objectives" label="Objectives of the engagement" value={content.objectives} rows={3} />
            <Area name="scope" label="Scope of the engagement" value={content.scope} rows={4}
              hint="The period covered is printed above this from the years chosen." />
            <Area name="methodology" label="Methodology" value={content.methodology} rows={4} />
            <Area name="strengths" label="Areas of strength" value={content.strengths} rows={6} />
            <Area name="weaknesses" label="Areas of weakness" value={content.weaknesses} rows={6} />
            <Area name="effectiveness" label="Effectiveness of internal control, risk management and governance" value={content.effectiveness} rows={4} />

            <h3>Maintenance and improvement project</h3>
            <p className="note">The amount transferred and the expenditure come from the infrastructure book.</p>
            {years.map((y) => (
              <div key={y} className="grid-3" style={{ marginBottom: ".75rem" }}>
                <label className="field">{y}: approved project
                  <input name={`project_${y}`} defaultValue={content.projects[y]?.project} />
                </label>
                <label className="field">SCDE approval
                  <input name={`approval_${y}`} defaultValue={content.projects[y]?.approval} placeholder="Approved" />
                </label>
                <label className="field">Project status
                  <input name={`status_${y}`} defaultValue={content.projects[y]?.status} placeholder="Completed" />
                </label>
              </div>
            ))}

            <h3>Recommendation matrix</h3>
            <table>
              <thead><tr><th>Audit issue</th><th>Management comments</th><th>Who is responsible</th><th>Time frame</th></tr></thead>
              <tbody>
                {recs.map((r, i) => (
                  <tr key={i}>
                    <td><input name="issue" defaultValue={r.issue} /></td>
                    <td><textarea name="comments" defaultValue={r.comments} rows={2} /></td>
                    <td><input name="who" defaultValue={r.who} /></td>
                    <td><input name="timeframe" defaultValue={r.timeframe} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="note">A row with no audit issue is dropped. Save to get more blank rows.</p>

            <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginTop: "1.25rem" }}>
              <button type="submit" className="btn btn-primary">Save</button>
              {saved && <span className="note">Saved.</span>}
            </div>
          </form>

          <div className="card" style={{ marginBottom: "2rem", display: "flex", gap: "1.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <form action={issueReport}>
              <input type="hidden" name="reportId" value={report.id} />
              <button type="submit" className="btn btn-primary">Issue report</button>
            </form>
            <p className="note" style={{ flex: "1 1 20rem", margin: 0 }}>
              Save first. Issuing freezes the figures and your text as they stand; the report then
              never changes, and the school can open it from its books.
            </p>
            <form action={deleteDraft}>
              <input type="hidden" name="reportId" value={report.id} />
              <button type="submit" className="btn-link">Discard draft</button>
            </form>
          </div>
        </div>
      )}

      <IpsasReport data={data} content={content} issuedAt={report.issuedAt} />
    </div>
  );
}
