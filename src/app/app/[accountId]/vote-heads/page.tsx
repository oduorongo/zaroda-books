import { buildLedger, formatKes } from "@/domain";
import { loadBook } from "@/server/book-context";
import { getEnrolmentInForce, getTxns, getVoteHeadRates } from "@/server/queries";
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
  const enrolment = await getEnrolmentInForce(fy.id);
  const learners = enrolment?.learners ?? 0;

  /** What the circular comes to per head at the enrolment in force. */
  const due = (code: string) =>
    (rates[code]?.perLearner ?? 0) * learners + (rates[code]?.flatAmount ?? 0);
  const totalDue = heads.reduce((a, h) => a + due(h.code), 0);

  // Everything credited to each head so far, across every receipt in the year —
  // the same figure the ledger carries, beside the rate it came from.
  const received = Object.fromEntries(
    buildLedger(await getTxns(fy.id), heads).map((l) => [l.code, l.cr]),
  );
  const totalReceived = heads.reduce((a, h) => a + (received[h.code] ?? 0), 0);

  return (
    <ReportShell
      title="Vote heads"
      sub={<>
        {school.name} — {account.name}, FY {fy.label}. The chart opened with the account holds only
        what the Ministry banks for the school; centrally procured items are left out. Add heads of
        your own below — existing ones are never renumbered.
      </>}
      school={school.name} level={school.level} account={account.name} fyLabel={fy.label}
      period={enrolment ? `${learners.toLocaleString("en-KE")} learners` : undefined}
      csvHref={`/app/${accountId}/vote-heads/export`}
      landscape
    >
      <p className="note" style={{ marginTop: "-1rem", marginBottom: "1.5rem" }}>
        {enrolment
          ? `${learners.toLocaleString("en-KE")} learners, derived from the disbursement receipted on `
            + `${enrolment.date}${enrolment.receiptNo ? ` (${enrolment.receiptNo})` : ""}. `
            + "The amounts due are what the rates come to at that enrolment, not what was received."
          : "No capitation receipt has been posted yet, so there is no enrolment to work from."}
      </p>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th style={{ width: "3rem" }}>#</th>
              <th>Code</th>
              <th>Name</th>
              <th className="n">Rate per learner</th>
              <th className="n">Flat amount</th>
              <th className="n">Learners</th>
              <th className="n">Due per disbursement</th>
              <th className="n">Received to date</th>
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
                  <td className="n" style={{ color: "var(--muted)" }}>
                    {r?.perLearner && learners ? learners.toLocaleString("en-KE") : "—"}
                  </td>
                  <td className="n">{due(h.code) ? formatKes(due(h.code)) : "—"}</td>
                  <td className="n">{received[h.code] ? formatKes(received[h.code]) : "—"}</td>
                </tr>
              );
            })}
            <tr className="total">
              <td colSpan={6}>Total due at {learners.toLocaleString("en-KE")} learners</td>
              <td className="n">{formatKes(totalDue)}</td>
              <td className="n">{formatKes(totalReceived)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2 className="no-print">Add a vote head</h2>
      <AddVoteHeadForm accountId={accountId} />
    </ReportShell>
  );
}
