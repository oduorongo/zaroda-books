import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { formatKes } from "@/domain";
import { getCurrentUser } from "@/server/auth";
import { Waiting } from "./waiting";

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Scoped by org, so a payment id from another tenant is simply not found.
  const [payment] = await db.select().from(schema.subscriptionPayments).where(and(
    eq(schema.subscriptionPayments.id, paymentId),
    eq(schema.subscriptionPayments.orgId, user.orgId),
  ));
  if (!payment) notFound();

  return (
    <div style={{ maxWidth: 620 }}>
      <Link href="/app/subscribe" className="back-link">← Subscriptions</Link>
      <h1>KSh {formatKes(payment.amount)}</h1>
      <p className="sub" style={{ textTransform: "capitalize" }}>
        {payment.level} · {payment.fyLabel} · {payment.phone}
      </p>
      <Waiting paymentId={payment.id} initial={payment.status} accountId={payment.createdAccountId} />
    </div>
  );
}
