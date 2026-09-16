import { buildLedger, formatKes, toKes } from "@/domain";
import { loadBook } from "@/server/book-context";
import { getTxns, getVoteHeadRates } from "@/server/queries";
import { ReceiptForm } from "./form";
import { OpeningBalances } from "./opening-balances";

export default async function ReceiptsPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;
  const { heads, fy, school, account } = await loadBook(accountId);
  const [rates, txns] = await Promise.all([getVoteHeadRates(fy.id), getTxns(fy.id)]);

  const received = Object.fromEntries(
    buildLedger(txns, heads).map((l) => [l.code, l.cr]),
  );
  const receipts = txns
    .filter((t) => t.kind === "receipt")
    .sort((a, b) => b.date.localeCompare(a.date));
  const totalReceived = receipts.reduce((a, r) => a + (r.kind === "receipt" ? r.cash + r.bank : 0), 0);

  return (
    <>
      <h1>Receipts</h1>
      <p className="sub">
        {school.name} — {account.name}, FY {fy.label}. Enter the amount received and the rates per
        learner in force. The system derives the enrolment from the amount and the vote heads used,
        then distributes the receipt so the split equals the amount received to the shilling.
      </p>

      <OpeningBalances
        accountId={accountId}
        fyLabel={fy.label}
        openingCash={fy.openingCash ? String(toKes(fy.openingCash)) : ""}
        openingBank={fy.openingBank ? String(toKes(fy.openingBank)) : ""}
      />

      <ReceiptForm
        accountId={accountId}
        heads={heads}
        rates={Object.fromEntries(
          Object.entries(rates).map(([code, r]) => [code, {
            rate: r.perLearner ? String(toKes(r.perLearner)) : "",
            flat: r.flatAmount ? String(toKes(r.flatAmount)) : "",
          }]),
        )}
      />

      <div className="grid-2" style={{ marginTop: "1.6rem", alignItems: "start" }}>
        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Total received per vote head</h2>
          <table>
            <thead>
              <tr><th>Vote head</th><th className="n">Total received</th></tr>
            </thead>
            <tbody>
              {heads.map((h) => (
                <tr key={h.code}>
                  <td><span className="code" style={{ marginRight: ".6rem" }}>{h.code}</span>{h.name}</td>
                  <td className="n">{formatKes(received[h.code] ?? 0)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total</td>
                <td className="n">{formatKes(totalReceived)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Receipts posted</h2>
          {receipts.length === 0 && <p className="note">Nothing posted yet.</p>}
          {receipts.map((r) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", padding: ".75rem 0", borderBottom: "1px solid var(--rule-soft)" }}>
              <div style={{ fontSize: ".9rem" }}>
                <div style={{ fontWeight: 500 }}>{r.particulars}</div>
                <div className="note">
                  {r.date}{r.kind === "receipt" && r.receiptNo ? ` · ${r.receiptNo}` : ""}
                </div>
              </div>
              <div className="mono" style={{ fontSize: ".9rem", whiteSpace: "nowrap" }}>
                {formatKes(r.kind === "receipt" ? r.cash + r.bank : 0)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
