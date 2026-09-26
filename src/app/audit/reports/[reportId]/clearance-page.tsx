import Link from "next/link";
import {
  clearanceData, CLEARANCE_REASONS, parseClearance, unsettledQueriesOn, type ClearanceData,
} from "@/server/audit-reports";
import type { schema } from "@/db";
import { PrintButton } from "../../../app/[accountId]/print-button";
import { ClearanceMemo } from "../../clearance-memo";
import { deleteDraft, issueReport, saveClearance } from "../actions";

/** A clearance memo: the particulars while a draft, the memo beneath. */
export async function ClearancePage({ report, auditor, saved, error }: {
  report: typeof schema.auditReports.$inferSelect;
  auditor: string;
  saved: boolean;
  error?: string;
}) {
  const memo = parseClearance(report.content);
  const data: ClearanceData = report.snapshot
    ? JSON.parse(report.snapshot)
    : await clearanceData(report.schoolId, auditor);
  const draft = report.status === "draft";
  const unsettled = draft ? await unsettledQueriesOn(report.schoolId) : 0;

  return (
    <div className="wrap" style={{ padding: "2.5rem 2.5rem 5rem", maxWidth: 900 }}>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <Link href={`/audit/schools/${report.schoolId}`}>← {data.school}</Link>
        <PrintButton />
      </div>

      {draft && (
        <div className="no-print">
          {unsettled > 0 && (
            <p className="error" style={{ marginBottom: "1rem" }}>
              {unsettled} audit {unsettled === 1 ? "query is" : "queries are"} on this school not yet closed.
            </p>
          )}
          <form action={saveClearance} className="card" style={{ marginBottom: "1.35rem" }}>
            <input type="hidden" name="reportId" value={report.id} />
            <h2 style={{ marginTop: 0 }}>Clearance memo</h2>
            <div className="grid-2">
              <label className="field">Head of institution
                <input name="officer" defaultValue={memo.officer} required />
              </label>
              <label className="field">TSC number
                <input name="tscNo" defaultValue={memo.tscNo} required />
              </label>
              <label className="field">Leaving on
                <select name="reason" defaultValue={memo.reason}>
                  {CLEARANCE_REASONS.map((r) => <option key={r} value={r} style={{ textTransform: "capitalize" }}>{r}</option>)}
                </select>
              </label>
              <label className="field">Cleared for the years up to
                <input name="periodTo" type="date" defaultValue={report.periodTo ?? ""} required />
              </label>
              <label className="field">To
                <input name="addressee" defaultValue={memo.addressee} />
              </label>
              <label className="field">From
                <input name="from" defaultValue={memo.from} />
              </label>
              <label className="field">Reference
                <input name="reference" defaultValue={memo.reference} />
              </label>
            </div>
            <label className="field" style={{ marginTop: "1rem" }}>Copy to, one per line
              <textarea name="copyTo" defaultValue={memo.copyTo} rows={3} style={{ width: "100%" }} />
            </label>
            <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginTop: "1.25rem" }}>
              <button type="submit" className="btn btn-primary">Save</button>
              {saved && <span className="note">Saved.</span>}
            </div>
          </form>

          <div className="card" style={{ marginBottom: "2rem", display: "flex", gap: "1.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <form action={issueReport}>
              <input type="hidden" name="reportId" value={report.id} />
              <button type="submit" className="btn btn-primary">Issue memo</button>
            </form>
            <p className="note" style={{ flex: "1 1 20rem", margin: 0 }}>
              Save first. Issuing dates the memo and freezes it; the school can then open it from its books.
            </p>
            <form action={deleteDraft}>
              <input type="hidden" name="reportId" value={report.id} />
              <button type="submit" className="btn-link">Discard draft</button>
            </form>
          </div>
          {error === "incomplete" && (
            <p className="error">Enter the head of institution, the TSC number and the date before issuing.</p>
          )}
        </div>
      )}

      <ClearanceMemo data={data} memo={memo} periodTo={report.periodTo} issuedAt={report.issuedAt} />
    </div>
  );
}
