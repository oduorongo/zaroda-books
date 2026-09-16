import Link from "next/link";
import { notFound } from "next/navigation";
import { formatKes } from "@/domain";
import { loadBook } from "@/server/book-context";
import { getTxns } from "@/server/queries";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export default async function AcknowledgementPage({
  params,
}: {
  params: Promise<{ accountId: string; transactionId: string }>;
}) {
  const { accountId, transactionId } = await params;
  const { heads, fy, school, account } = await loadBook(accountId);

  const txns = await getTxns(fy.id);
  const txn = txns.find((t) => t.id === transactionId);
  if (!txn || txn.kind !== "receipt") notFound();

  const [row] = await db
    .select({ enrolment: schema.transactions.enrolment })
    .from(schema.transactions)
    .where(eq(schema.transactions.id, transactionId));

  const nameOf = (code: string) => heads.find((h) => h.code === code)?.name ?? code;
  const total = txn.cash + txn.bank;

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <Link href={`/app/${accountId}/receipts`}>← Back to receipts</Link>
        <span style={{ display: "flex", gap: "1.1rem", alignItems: "center" }}>
          <Link href={`/app/${accountId}/receipts/${transactionId}/edit`}>Amend this receipt</Link>
          <span className="note">Print this page to return it to the Ministry.</span>
        </span>
      </div>

      <div className="card">
        <div className="eyebrow">Acknowledgement of receipt</div>
        <h1 style={{ marginTop: ".6rem" }}>{school.name}</h1>
        <p className="sub" style={{ marginBottom: "1.75rem" }}>
          {account.name} account · FY {fy.label}
        </p>

        <table>
          <tbody>
            <tr><td>Date received</td><td className="n">{txn.date}</td></tr>
            <tr><td>Receipt no.</td><td className="n">{txn.receiptNo ?? "—"}</td></tr>
            <tr><td>Particulars</td><td className="n">{txn.particulars}</td></tr>
            <tr><td>Amount received</td><td className="n">{formatKes(total)}</td></tr>
            <tr>
              <td>Enrolment used</td>
              <td className="n">{row?.enrolment?.toLocaleString("en-KE") ?? "—"}</td>
            </tr>
          </tbody>
        </table>

        <h2>Distribution per vote head</h2>
        <table>
          <thead>
            <tr><th>Vote head</th><th className="n">Amount</th></tr>
          </thead>
          <tbody>
            {txn.allocations.map((a) => (
              <tr key={a.voteHeadCode}>
                <td><span className="code" style={{ marginRight: ".6rem" }}>{a.voteHeadCode}</span>{nameOf(a.voteHeadCode)}</td>
                <td className="n">{formatKes(a.amount)}</td>
              </tr>
            ))}
            <tr className="total">
              <td>Total</td>
              <td className="n">{formatKes(total)}</td>
            </tr>
          </tbody>
        </table>

        <p className="note" style={{ marginTop: "1.75rem" }}>
          The enrolment shown was derived from the amount disbursed and the per-learner rates in the
          circular in force. Signed ______________________ on ______________.
        </p>
      </div>
    </div>
  );
}
