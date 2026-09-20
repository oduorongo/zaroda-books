import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { formatKes } from "@/domain";
import { getCurrentUser } from "@/server/auth";
import { csvResponse, docToCsv } from "@/server/reports";

const stamp = (d: Date | null) =>
  d ? new Date(d).toLocaleString("en-KE", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  }) : "—";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ paymentId: string }> },
) {
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
  if (!row || row.payment.status !== "success") notFound();

  const { payment, org } = row;
  const doc = {
    title: `Subscription receipt ${payment.receiptNo ?? ""}`.trim(),
    school: "ZARODA SOLUTIONS",
    account: org.name,
    fyLabel: payment.fyLabel,
    period: stamp(payment.paidAt),
    landscape: false,
    filename: `subscription-receipt-${(payment.receiptNo ?? payment.id).replace(/\//g, "-")}`,
    sections: [
      {
        heading: "Received with thanks",
        rows: [
          ["Receipt no.", payment.receiptNo ?? "—"],
          ["From", org.name],
          ["For", `${payment.level} school subscription`],
          ["Financial year", payment.fyLabel],
          ["Paid by", `M-Pesa · ${payment.phone}`],
          ["M-Pesa receipt", payment.mpesaReceipt ?? "—"],
          ["Date paid", stamp(payment.paidAt)],
        ],
        total: ["Amount paid", formatKes(payment.amount)],
        note:
          `This subscription covers every account kept at ${payment.level} level for one `
          + `school, for the financial year ${payment.fyLabel} — tuition, operations, `
          + "infrastructure, boarding and lunch. The school it is used for is fixed by the "
          + "first book opened against it. Computer generated; no signature is required.",
      },
    ],
  };

  if (new URL(request.url).searchParams.get("format") === "json") return Response.json(doc);
  return csvResponse(docToCsv(doc));
}
