import { formatKes } from "@/domain";
import { loadBook } from "@/server/book-context";
import { getVoteHeadRates } from "@/server/queries";
import { AddVoteHeadForm } from "./form";
import { ReportShell } from "../report-shell";

export default async function VoteHeadsPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const { heads, fy, school, account } = await loadBook(accountId);
  const rates = await getVoteHeadRates(fy.id);

  return (
    <ReportShell
      title="Vote heads"
      sub={<>
        {school.name} — {account.name}, FY {fy.label}. The chart opened with the account holds only
        what the Ministry banks for the school; centrally procured items are left out. Add heads of
        your own below — existing ones are never renumbered.
      </>}
      school={school.name} account={account.name} fyLabel={fy.label}
      csvHref={`/app/${accountId}/vote-heads/export`}
    >

      <div className="card" style={{ maxWidth: 820 }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: "3rem" }}>#</th>
              <th>Code</th>
              <th>Name</th>
              <th className="n">Rate per learner</th>
              <th className="n">Flat amount</th>
            </tr>
          </thead>
          <tbody>
            {heads.map((h) => {
              const r = rates[h.code];
              return (
                <tr key={h.code}>
                  <td className="mono" style={{ color: "var(--muted)" }}>{h.order}</td>
                  <td><span className="code">{h.code}</span></td>
                  <td>{h.name}</td>
                  <td className="n">{r?.perLearner ? formatKes(r.perLearner) : "—"}</td>
                  <td className="n">{r?.flatAmount ? formatKes(r.flatAmount) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="no-print">Add a vote head</h2>
      <AddVoteHeadForm accountId={accountId} />
    </ReportShell>
  );
}
