import Link from "next/link";
import { requirePlatformAdmin } from "@/server/platform";
import { unseenProblems } from "@/server/problems";
import { MarkAllSeen, MarkSeen } from "./forms";

const stamp = (d: Date) =>
  new Date(d).toLocaleString("en-KE", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

/** Payment first: it is the one where somebody is out of pocket. */
const TONE: Record<string, string> = {
  payment: "var(--alarm)",
  book: "var(--alarm)",
  gateway: "var(--gold)",
  email: "var(--muted)",
};

export default async function ProblemsPage() {
  await requirePlatformAdmin();
  const rows = await unseenProblems();

  return (
    <>
      <Link href="/admin" className="back-link">← All tenants</Link>
      <div className="report-bar">
        <div>
          <h1>Problems</h1>
          <p className="sub">
            Failures that need a person. Not an application log — only what somebody has to
            act on. Marking one seen hides it; nothing is deleted.
          </p>
        </div>
        {rows.length > 0 && <div className="report-actions"><MarkAllSeen /></div>}
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <p className="note" style={{ margin: 0 }}>
            Nothing outstanding. Payment failures, undeliverable email and gateway refusals
            appear here.
          </p>
        ) : (
          <table>
            <thead>
              <tr><th>When</th><th>Area</th><th>What happened</th><th>Tenant</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map(({ problem, orgName }) => (
                <tr key={problem.id}>
                  <td>{stamp(problem.at)}</td>
                  <td style={{ color: TONE[problem.area] ?? "var(--muted)", textTransform: "capitalize" }}>
                    {problem.area}
                  </td>
                  <td>
                    {problem.message}
                    {problem.detail && (
                      <div className="note mono" style={{ fontSize: ".72rem", marginTop: ".25rem" }}>
                        {problem.detail.slice(0, 300)}
                      </div>
                    )}
                  </td>
                  <td>{orgName ?? "—"}</td>
                  <td><MarkSeen problemId={problem.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
