import Link from "next/link";
import { BOOKS_CHECKLIST, parsePrimary, primaryData, type PrimaryData } from "@/server/audit-reports";
import type { schema } from "@/db";
import { PrintButton } from "../../../app/[accountId]/print-button";
import { PrimaryStatements } from "../../primary-statements";
import { deleteDraft, issueReport, savePrimary } from "../actions";

/** Audited financial statements: what the auditor writes while a draft, the statements beneath. */
export async function PrimaryPage({ report, auditor, saved, error }: {
  report: typeof schema.auditReports.$inferSelect;
  auditor: string;
  saved: boolean;
  error?: string;
}) {
  const content = parsePrimary(report.content);
  const data: PrimaryData = report.snapshot
    ? JSON.parse(report.snapshot)
    : await primaryData(report.schoolId, report.periodFrom!, report.periodTo!, report.auditorId, auditor);
  const draft = report.status === "draft";

  return (
    <div className="wrap" style={{ padding: "2.5rem 2.5rem 5rem", maxWidth: 1000 }}>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <Link href={`/audit/schools/${report.schoolId}`}>← {data.school}</Link>
        <PrintButton />
      </div>

      {draft && (
        <div className="no-print">
          <form action={savePrimary} className="card" style={{ marginBottom: "1.35rem" }}>
            <input type="hidden" name="reportId" value={report.id} />
            <h2 style={{ marginTop: 0 }}>What you write</h2>
            <p className="note" style={{ marginBottom: "1rem" }}>
              Every figure comes from the books for {data.from} to {data.to} and cannot be typed.
            </p>
            <div className="grid-3">
              <label className="field">Head teacher
                <input name="headTeacher" defaultValue={content.headTeacher} />
              </label>
              <label className="field">TSC number
                <input name="tscNo" defaultValue={content.tscNo} />
              </label>
              <label className="field">Zone
                <input name="zone" defaultValue={content.zone} />
              </label>
            </div>
            <label className="field" style={{ marginTop: "1rem" }}>Audit certificate
              <textarea name="certificate" defaultValue={content.certificate} rows={4} style={{ width: "100%" }} />
              <span className="note">The opinion paragraph, naming the school and the date, is printed after this.</span>
            </label>
            <label className="field" style={{ marginTop: "1rem" }}>Observations on procurement, one per line
              <textarea name="procurement" defaultValue={content.procurement} rows={4} style={{ width: "100%" }} />
            </label>
            <label className="field" style={{ marginTop: "1rem" }}>Management of the general operations account
              <textarea name="management" defaultValue={content.management} rows={4} style={{ width: "100%" }} />
            </label>

            <h3>Maintenance of books of account</h3>
            <table>
              <thead><tr><th>Item</th><th>Observation</th></tr></thead>
              <tbody>
                {BOOKS_CHECKLIST.map((item, i) => (
                  <tr key={item}>
                    <td>{item}</td>
                    <td><input name={`book_${i}`} defaultValue={content.books[item]} placeholder="e.g. Written and balanced" /></td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginTop: "1.25rem" }}>
              <button type="submit" className="btn btn-primary">Save</button>
              {saved && <span className="note">Saved.</span>}
            </div>
          </form>

          <div className="card" style={{ marginBottom: "2rem", display: "flex", gap: "1.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <form action={issueReport}>
              <input type="hidden" name="reportId" value={report.id} />
              <button type="submit" className="btn btn-primary">Issue statements</button>
            </form>
            <p className="note" style={{ flex: "1 1 20rem", margin: 0 }}>
              Save first. Issuing freezes the figures and your text; the school can then open them from its books.
            </p>
            <form action={deleteDraft}>
              <input type="hidden" name="reportId" value={report.id} />
              <button type="submit" className="btn-link">Discard draft</button>
            </form>
          </div>
          {error === "uncovered" && (
            <p className="error">The books do not cover the whole period, so the statements cannot be issued.</p>
          )}
        </div>
      )}

      <PrimaryStatements data={data} content={content} issuedAt={report.issuedAt} />
    </div>
  );
}
