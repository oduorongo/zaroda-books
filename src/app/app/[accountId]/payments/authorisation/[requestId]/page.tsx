import { notFound } from "next/navigation";
import { can, formatKes } from "@/domain";
import { loadBook } from "@/server/book-context";
import { paperSchedule } from "@/server/authorisation";
import { ReportShell } from "../../../report-shell";
import { RecordScheduleForm } from "./record-form";

/**
 * The schedule the head signs. Printed from the payments as they stood when
 * it was prepared, so a reprint matches the paper already signed.
 */
export default async function SchedulePage({ params }: {
  params: Promise<{ accountId: string; requestId: string }>;
}) {
  const { accountId, requestId } = await params;
  const { user, fy, school, account } = await loadBook(accountId);
  const found = await paperSchedule(accountId, requestId);
  if (!found) notFound();
  const { req, lines } = found;
  const total = lines.reduce((a, l) => a + l.cash + l.bank, 0);
  const ref = req.id.slice(0, 8).toUpperCase();
  const heads = (l: (typeof lines)[number]) => l.lines.map(([c, a]) => `${c} ${formatKes(a)}`).join(", ");

  return (
    <ReportShell
      title="Payment authorisation schedule"
      sub={<>Print this, have the head sign it, then record it below. Ref. {ref}.</>}
      school={school.name} level={school.level} account={account.name} fyLabel={fy.label}
    >
      <p style={{ margin: "0 0 1rem" }}>
        Ref. <span className="mono">{ref}</span> · prepared {req.createdAt.toISOString().slice(0, 10)}
      </p>
      <table>
        <thead>
          <tr><th>VR</th><th>Date</th><th>Paid to</th><th>Vote heads</th><th className="n">Amount</th></tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.id}>
              <td className="mono">{l.removed ? "deleted" : l.vrNo ?? "—"}</td>
              <td className="mono">{l.date}</td>
              <td>{l.payee}{l.narration && <div className="note">{l.narration}</div>}</td>
              <td className="note">{heads(l)}</td>
              <td className="n">{formatKes(l.cash + l.bank)}</td>
            </tr>
          ))}
          <tr className="total"><td colSpan={4}>Total</td><td className="n">{formatKes(total)}</td></tr>
        </tbody>
      </table>

      <p style={{ marginTop: "1.75rem", lineHeight: 1.7 }}>
        I authorise the payments listed above, except any I have struck out with my reason beside it.
      </p>
      <div className="voucher-signatures">
        <div>
          <div className="eyebrow" style={{ marginBottom: ".5rem" }}>Head of institution</div>
          <p style={{ margin: "0 0 .6rem" }}>{req.hoiName}{req.hoiTsc ? `, TSC ${req.hoiTsc}` : ""}</p>
          <div style={{ borderBottom: "1px solid var(--rule-strong)", height: "1.6rem" }} />
          <div className="note">Signature and date</div>
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: ".5rem" }}>School stamp</div>
          <div style={{ border: "1px dashed var(--rule-strong)", height: "5rem" }} />
        </div>
      </div>

      {req.completedAt ? (
        <p className="verdict ok no-print">Recorded as signed on {req.signedOn}.</p>
      ) : user.readOnly || !can(user.role, "entry.post") ? null : (
        <RecordScheduleForm
          accountId={accountId}
          requestId={req.id}
          rows={lines.filter((l) => !l.removed).map((l) => ({
            id: l.id, vrNo: l.vrNo, date: l.date, payee: l.payee, detail: heads(l),
            amount: l.cash + l.bank, terms: l.terms,
          }))}
        />
      )}
    </ReportShell>
  );
}
