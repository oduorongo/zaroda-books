import Link from "next/link";
import { can, formatKes, projectKey, takesProject, type AccountType } from "@/domain";
import { loadBook } from "@/server/book-context";
import { getTxns } from "@/server/queries";
import { schoolProjects, storageReady } from "@/server/documents";
import { ReportShell } from "../report-shell";
import { AttachLetter, RemoveLetter } from "./forms";

/**
 * The school's infrastructure projects and their SCDE approvals. A project is
 * named on the receipts; no payment is made for it until its approval is here.
 */
export default async function ProjectsPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const { user, fy, school, account } = await loadBook(accountId);
  if (!takesProject(account.type as AccountType)) {
    return <p className="note">Projects belong to the infrastructure account.</p>;
  }
  const [projects, txns] = await Promise.all([schoolProjects(school.id), getTxns(fy.id)]);
  const paid = (key: string) => txns.reduce((a, t) =>
    a + (t.kind === "payment" && t.project && projectKey(t.project) === key ? t.cash + t.bank : 0), 0);
  const posts = can(user.role, "entry.post") && !user.readOnly;

  return (
    <ReportShell
      title="Projects and SCDE approvals"
      sub={<>Projects named on this school&apos;s infrastructure receipts. Attach each project&apos;s SCDE approval before paying for it.</>}
      school={school.name} level={school.level} account={account.name} fyLabel={fy.label}
    >
      {!storageReady() && posts && (
        <p className="error no-print">File storage is not set up yet, so approvals cannot be attached.</p>
      )}
      <table>
        <thead><tr><th>Project</th><th className="n">Paid this year</th><th>SCDE approval</th></tr></thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.key}>
              <td>{p.name}</td>
              <td className="n">{formatKes(paid(p.key))}</td>
              <td>
                {p.letter ? (
                  <>
                    <a href={`/app/${accountId}/projects/letters/${p.letter.id}`} target="_blank" rel="noreferrer">
                      {p.letter.fileName}
                    </a>
                    <span className="note"> — attached {p.letter.addedAt.toISOString().slice(0, 10)}</span>
                    {can(user.role, "entry.delete") && !user.readOnly && (
                      <span className="no-print"> · <RemoveLetter accountId={accountId} letterId={p.letter.id} /></span>
                    )}
                  </>
                ) : (
                  <>
                    <span className="error">Not attached</span>
                    {posts && <div className="no-print" style={{ marginTop: ".4rem" }}><AttachLetter accountId={accountId} project={p.name} /></div>}
                  </>
                )}
              </td>
            </tr>
          ))}
          {projects.length === 0 && (
            <tr><td colSpan={3} className="note">
              No projects yet. A project is named when money for it is received — see{" "}
              <Link href={`/app/${accountId}/receipts`}>Receipts</Link>.
            </td></tr>
          )}
        </tbody>
      </table>
    </ReportShell>
  );
}
