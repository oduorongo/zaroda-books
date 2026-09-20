import Link from "next/link";
import { redirect } from "next/navigation";
import { chargeAmount, financialYearInProgress, financialYearLabels, formatKes } from "@/domain";
import { getCurrentUser } from "@/server/auth";
import { orgPayments } from "@/server/billing";
import { orgEntitlements } from "@/server/books";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { BackLink } from "../back-link";
import { SubscribeForm } from "./form";

const stamp = (d: Date | null) =>
  d ? new Date(d).toLocaleString("en-KE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default async function SubscribePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [{ covered }, payments, [account]] = await Promise.all([
    orgEntitlements(user.orgId),
    orgPayments(user.orgId),
    // The subscriber's own number, so the commonest case is one tap.
    db.select({ phone: schema.users.phone }).from(schema.users)
      .where(eq(schema.users.id, user.id)),
  ]);

  // A year ahead is offered: schools subscribe before 1 July as often as after.
  const years = financialYearLabels(financialYearInProgress() + 1, financialYearInProgress() - 2);

  return (
    <div style={{ maxWidth: 820 }}>
      <div style={{ marginBottom: ".75rem" }}><BackLink /></div>
      <h1>Subscribe</h1>
      <p className="sub">
        One payment per school level, per financial year, covering every account that level
        keeps — tuition, operations, infrastructure, boarding, lunch. Paid by M-Pesa.
      </p>

      <SubscribeForm
        years={years}
        defaultPhone={account?.phone ?? ""}
        testAmountCents={chargeAmount(0, process.env.TUMA_TEST_AMOUNT_KES).isTest
          ? chargeAmount(0, process.env.TUMA_TEST_AMOUNT_KES).cents
          : null}
      />

      {covered.length > 0 && (
        <div className="card" style={{ marginTop: "1.6rem" }}>
          <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: ".75rem" }}>
            What you already hold
          </div>
          <table>
            <thead><tr><th>Year</th><th>Level</th><th>How</th></tr></thead>
            <tbody>
              {covered.map((c) => (
                <tr key={`${c.level}-${c.fyLabel}`}>
                  <td>{c.fyLabel}</td>
                  <td style={{ textTransform: "capitalize" }}>{c.level}</td>
                  <td>{c.isFree ? "Your free school" : c.paidAt ? "Paid" : "Payment pending"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {payments.length > 0 && (
        <div className="card" style={{ marginTop: "1.35rem" }}>
          <div className="eyebrow" style={{ color: "var(--gold)", marginBottom: ".75rem" }}>
            Payments
          </div>
          <table>
            <thead>
              <tr>
                <th>When</th><th>For</th><th className="n">Amount</th>
                <th>M-Pesa receipt</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td>{stamp(p.createdAt)}</td>
                  <td style={{ textTransform: "capitalize" }}>{p.level} {p.fyLabel}</td>
                  <td className="n">{formatKes(p.amount)}</td>
                  <td className="mono">{p.mpesaReceipt ?? "—"}</td>
                  <td style={{ color: p.status === "success" ? "var(--gold)" : p.status === "failed" ? "var(--alarm)" : undefined }}>
                    {p.status === "pending"
                      ? <Link href={`/app/subscribe/${p.id}`}>waiting…</Link>
                      : p.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
