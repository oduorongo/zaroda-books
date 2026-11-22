import { and, eq, isNotNull } from "drizzle-orm";
import { db, schema } from "@/db";

/**
 * Run daily by Vercel Cron (vercel.json): sends every paid Zaroda Books subscription to the ZARODA POS, so it is
 * posted to ZARODA's own books as Zaroda Books income. The POS stores each payment once, so sending all of them each
 * day is safe. Needs ZARODA_INCOME_SYNC_KEY (= BOOKS_INCOME_SYNC_KEY on the POS); POS_API_URL defaults to
 * https://api.zarodashop.com. Without the key nothing is sent.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized.", { status: 401 });
  }
  const key = (process.env.ZARODA_INCOME_SYNC_KEY ?? "").trim().replace(/^["']+|["']+$/g, "").trim();
  if (key.length < 24) return Response.json({ sent: 0, skipped: "ZARODA_INCOME_SYNC_KEY is not set" });

  const paid = await db
    .select({
      id: schema.subscriptionPayments.id,
      school: schema.orgs.name,
      level: schema.subscriptionPayments.level,
      fyLabel: schema.subscriptionPayments.fyLabel,
      amount: schema.subscriptionPayments.amount,
      paidAt: schema.subscriptionPayments.paidAt,
      mpesaReceipt: schema.subscriptionPayments.mpesaReceipt,
    })
    .from(schema.subscriptionPayments)
    .innerJoin(schema.orgs, eq(schema.orgs.id, schema.subscriptionPayments.orgId))
    .where(and(eq(schema.subscriptionPayments.status, "success"), isNotNull(schema.subscriptionPayments.paidAt)));

  const url = `${(process.env.POS_API_URL || "https://api.zarodashop.com").replace(/\/+$/, "")}/sales-sync/income`;
  let added = 0;
  // The POS takes at most 300 receipts (and 100 KB) per request.
  for (let i = 0; i < paid.length; i += 250) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-income-sync-key": key },
      body: JSON.stringify({
        app: "BOOKS",
        receipts: paid.slice(i, i + 250).map((p) => ({
          id: p.id,
          payer: (p.school || "A school").slice(0, 200),
          description: `Zaroda Books subscription (${p.level}, ${p.fyLabel})`.slice(0, 120),
          amountKes: Number(p.amount) / 100,
          paidAt: new Date(p.paidAt!).toISOString(),
          ...(p.mpesaReceipt ? { reference: p.mpesaReceipt.slice(0, 60) } : {}),
        })),
      }),
    });
    if (!res.ok) return Response.json({ error: `POS answered ${res.status}: ${(await res.text()).slice(0, 300)}` }, { status: 502 });
    added += ((await res.json()) as { added?: number }).added ?? 0;
  }
  return Response.json({ sent: paid.length, added });
}
