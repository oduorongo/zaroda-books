import { formatKes, type Payment } from "@/domain";

export interface DecisionRow {
  id: string;
  vrNo?: string;
  date: string;
  payee: string;
  /** Vote heads and narration, as one line. */
  detail: string;
  amount: number;
  terms: string;
}

/**
 * The head's list: ticked is authorised, unticked with a reason is held back,
 * unticked without one is left for later. Read by readDecisions in the domain.
 * The terms go back with the form so a payment amended meanwhile is refused.
 */
export function DecisionTable({ rows }: { rows: DecisionRow[] }) {
  return (
    <>
      <input type="hidden" name="ids" value={rows.map((r) => r.id).join(",")} />
      <table>
        <thead>
          <tr><th>Authorise</th><th>VR</th><th>Date</th><th>Paid to</th><th className="n">Amount</th><th>Reason, if held back</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>
                <input type="checkbox" name={`ok_${r.id}`} defaultChecked aria-label={`Authorise VR ${r.vrNo ?? ""}`} />
                <input type="hidden" name={`terms_${r.id}`} value={r.terms} />
              </td>
              <td className="mono">{r.vrNo ?? "—"}</td>
              <td className="mono">{r.date}</td>
              <td>{r.payee}<div className="note">{r.detail}</div></td>
              <td className="n">{formatKes(r.amount)}</td>
              <td><input name={`reason_${r.id}`} placeholder="e.g. no delivery note" style={{ width: "100%" }} /></td>
            </tr>
          ))}
          <tr className="total">
            <td colSpan={4}>Total</td>
            <td className="n">{formatKes(rows.reduce((a, r) => a + r.amount, 0))}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

export const decisionRow = (p: Payment, terms: string): DecisionRow => ({
  id: p.id, vrNo: p.vrNo, date: p.date, payee: p.particulars, terms, amount: p.cash + p.bank,
  detail: [p.allocations.map((a) => `${a.voteHeadCode} ${formatKes(a.amount)}`).join(", "), p.narration]
    .filter(Boolean).join(" · "),
});
