import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { LEVEL_PRICE, formatKes } from "@/domain";
import { getCurrentUser } from "@/server/auth";
import { Logo } from "@/app/logo";
import { PdfButton } from "../../../[accountId]/pdf-button";
import { PrintButton } from "../../../[accountId]/print-button";
import { PoweredBy } from "../../../[accountId]/level-mark";

const stamp = (d: Date | null) =>
  d ? new Date(d).toLocaleString("en-KE", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  }) : "—";

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [row] = await db
    .select({ payment: schema.subscriptionPayments, org: schema.orgs })
    .from(schema.subscriptionPayments)
    .innerJoin(schema.orgs, eq(schema.orgs.id, schema.subscriptionPayments.orgId))
    .where(and(
      eq(schema.subscriptionPayments.id, paymentId),
      eq(schema.subscriptionPayments.orgId, user.orgId),
    ));

  // A receipt exists only for money actually received. Anything else would be
  // a document saying a payment was made when it was not.
  if (!row || row.payment.status !== "success") notFound();
  const { payment, org } = row;
  const exportHref = `/app/subscribe/${paymentId}/receipt/export`;

  return (
    <div style={{ maxWidth: 680 }}>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
        <Link href="/app/subscribe">← Subscriptions</Link>
        <span className="report-actions">
          <PdfButton href={exportHref} />
          <PrintButton />
        </span>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1.5rem", flexWrap: "wrap" }}>
          <div>
            <Logo height={54} variant="lockup" />
            <div className="note" style={{ marginTop: ".6rem", lineHeight: 1.6 }}>
              Zaroda Solutions<br />
              support@zarodabooks.com · 0724 282 065
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="eyebrow">Receipt</div>
            <div className="mono" style={{ fontSize: "1.1rem", fontWeight: 700, marginTop: ".3rem" }}>
              {payment.receiptNo ?? "—"}
            </div>
            <div className="note" style={{ marginTop: ".3rem" }}>{stamp(payment.paidAt)}</div>
          </div>
        </div>

        <h1 style={{ marginTop: "2rem" }}>Received with thanks</h1>
        <p className="sub">From {org.name}</p>

        <table>
          <tbody>
            <tr><td>For</td><td className="n" style={{ textTransform: "capitalize" }}>{payment.level} school subscription</td></tr>
            <tr><td>Financial year</td><td className="n">{payment.fyLabel}</td></tr>
            <tr><td>Paid by</td><td className="n">M-Pesa · {payment.phone}</td></tr>
            <tr><td>M-Pesa receipt</td><td className="n mono">{payment.mpesaReceipt ?? "—"}</td></tr>
            <tr className="total">
              <td>Amount paid</td>
              <td className="n">KSh {formatKes(payment.amount)}</td>
            </tr>
          </tbody>
        </table>

        {payment.amount !== LEVEL_PRICE[payment.level] && (
          <p className="note" style={{ color: "var(--alarm)", marginTop: "1rem" }}>
            This is not the list price of KSh {formatKes(LEVEL_PRICE[payment.level])} — it was a
            test transaction.
          </p>
        )}

        <p className="note" style={{ marginTop: "1.75rem", lineHeight: 1.7 }}>
          This subscription covers every account kept at {payment.level} level for one school,
          for the financial year {payment.fyLabel} — tuition, operations, infrastructure,
          boarding and lunch. The school it is used for is fixed by the first book opened
          against it.
        </p>

        <p className="note" style={{ marginTop: "1.25rem" }}>
          Computer generated. No signature is required.
        </p>
        <PoweredBy />
      </div>
    </div>
  );
}
