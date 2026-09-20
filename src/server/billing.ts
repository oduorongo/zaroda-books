import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  LEVEL_PRICE, normalisePhoneForTuma, priceLabel, type SchoolLevel,
} from "@/domain";
import {
  checkPaymentStatus, initiateStkPush, tumaCallbackUrl, tumaConfigured,
} from "@/server/tuma";

/**
 * Collecting the subscription. A confirmed payment opens the subscription row
 * for that level and year, which is the same row the book-opening gate looks
 * for — so paying is what lets the books open, with nothing to do by hand.
 */

export async function startSubscriptionPayment(input: {
  orgId: string;
  userId: string;
  level: SchoolLevel;
  fyLabel: string;
  phone: string;
}): Promise<{ ok: true; paymentId: string } | { ok: false; error: string }> {
  if (!tumaConfigured()) {
    return {
      ok: false,
      error:
        "M-Pesa payment is not switched on for this site yet. Reach us on WhatsApp "
        + "0781 230 805 and we will open the subscription for you.",
    };
  }

  const phone = normalisePhoneForTuma(input.phone);
  if (!phone) return { ok: false, error: "Enter the M-Pesa number as 07xx xxx xxx." };

  const [existing] = await db.select().from(schema.subscriptions).where(and(
    eq(schema.subscriptions.orgId, input.orgId),
    eq(schema.subscriptions.level, input.level),
    eq(schema.subscriptions.fyLabel, input.fyLabel),
  ));
  if (existing?.paidAt) {
    return { ok: false, error: "That level and year is already paid for." };
  }

  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.id, input.orgId));
  const amount = LEVEL_PRICE[input.level];
  const description = `Zaroda Books — ${input.level} ${input.fyLabel} (${org?.name ?? "subscription"})`;

  const result = await initiateStkPush({
    // Tuma bills in shillings; our money is cents everywhere else (rule 6).
    amountShillings: amount / 100,
    phone,
    description,
    callbackUrl: tumaCallbackUrl(),
  });

  const [row] = await db.insert(schema.subscriptionPayments).values({
    orgId: input.orgId,
    level: input.level,
    fyLabel: input.fyLabel,
    amount,
    phone,
    status: result.ok ? "pending" : "failed",
    merchantRequestId: result.merchantRequestId ?? null,
    description,
    rawResponse: JSON.stringify(result.raw ?? {}),
    initiatedBy: input.userId,
  }).returning();

  if (!result.ok) {
    return { ok: false, error: result.detail ?? "The payment could not be started." };
  }
  return { ok: true, paymentId: row.id };
}

/**
 * The single path from "money arrived" to "the books open", used by both the
 * webhook and the status poll. Writing the subscription and the payment
 * together is what stops a paid tenant still being refused a book.
 */
export async function markPaymentSucceeded(
  paymentId: string,
  mpesaReceipt: string | undefined,
  rawBody: unknown,
) {
  const [payment] = await db.select().from(schema.subscriptionPayments)
    .where(eq(schema.subscriptionPayments.id, paymentId));
  if (!payment) return;
  if (payment.status === "success") return; // Callback and poll can both arrive.

  const now = new Date();
  await db.update(schema.subscriptionPayments).set({
    status: "success",
    mpesaReceipt: mpesaReceipt ?? null,
    callbackRaw: JSON.stringify(rawBody ?? {}),
    paidAt: now,
    updatedAt: now,
  }).where(eq(schema.subscriptionPayments.id, paymentId));

  const [existing] = await db.select().from(schema.subscriptions).where(and(
    eq(schema.subscriptions.orgId, payment.orgId),
    eq(schema.subscriptions.level, payment.level),
    eq(schema.subscriptions.fyLabel, payment.fyLabel),
  ));

  if (existing) {
    await db.update(schema.subscriptions).set({ paidAt: now })
      .where(eq(schema.subscriptions.id, existing.id));
  } else {
    // Unbound: the school is decided by whichever book is opened against it first.
    await db.insert(schema.subscriptions).values({
      orgId: payment.orgId,
      level: payment.level,
      fyLabel: payment.fyLabel,
      paidAt: now,
    });
  }

  await db.insert(schema.auditLog).values({
    orgId: payment.orgId,
    userId: payment.initiatedBy,
    action: "subscription.paid.mpesa",
    entity: "subscription_payment",
    entityId: payment.id,
    before: JSON.stringify({ status: payment.status }),
    after: JSON.stringify({
      status: "success",
      mpesaReceipt: mpesaReceipt ?? null,
      level: payment.level,
      fyLabel: payment.fyLabel,
    }),
  });
}

export async function markPaymentFailed(paymentId: string, rawBody: unknown) {
  await db.update(schema.subscriptionPayments).set({
    status: "failed",
    callbackRaw: JSON.stringify(rawBody ?? {}),
    updatedAt: new Date(),
  }).where(eq(schema.subscriptionPayments.id, paymentId));
}

export async function findPaymentByMerchantRequest(merchantRequestId: string) {
  const [row] = await db.select().from(schema.subscriptionPayments)
    .where(eq(schema.subscriptionPayments.merchantRequestId, merchantRequestId));
  return row;
}

/**
 * Asks Tuma directly. The webhook is the normal path; this is what the waiting
 * page uses, because a callback that never arrives would otherwise leave a
 * tenant who has paid staring at "waiting" for ever.
 */
export async function pollPayment(paymentId: string, orgId: string) {
  const [payment] = await db.select().from(schema.subscriptionPayments).where(and(
    eq(schema.subscriptionPayments.id, paymentId),
    eq(schema.subscriptionPayments.orgId, orgId),
  ));
  if (!payment) return { status: "unknown" as const };
  if (payment.status !== "pending" || !payment.merchantRequestId) {
    return { status: payment.status };
  }

  const result = await checkPaymentStatus(payment.merchantRequestId);
  if (result.ok && result.status && /success|completed/i.test(result.status)) {
    await markPaymentSucceeded(payment.id, result.mpesaReceipt, result.raw);
    return { status: "success" as const };
  }
  return { status: "pending" as const, detail: result.detail };
}

export async function orgPayments(orgId: string) {
  return db.select().from(schema.subscriptionPayments)
    .where(eq(schema.subscriptionPayments.orgId, orgId))
    .orderBy(desc(schema.subscriptionPayments.createdAt));
}

export const subscriptionPriceLabel = (level: SchoolLevel) => priceLabel(level);
