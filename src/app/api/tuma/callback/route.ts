import { NextResponse } from "next/server";
import { parseTumaCallback } from "@/domain";
import { recordProblem } from "@/server/problems";
import {
  findPaymentByMerchantRequest, markPaymentFailed, markPaymentSucceeded,
} from "@/server/billing";

/**
 * Tuma calls this server-to-server with no session, so it cannot be behind
 * auth. What makes it safe is that it carries no instruction: the only thing
 * taken from the body is which payment it refers to, and the amount and what
 * it buys come from the row we wrote when the push went out. A forged callback
 * can therefore settle a payment we already initiated, but cannot invent one,
 * change a price, or name a different level.
 *
 * It always answers 200. A gateway that gets an error retries, and a retry
 * loop on a body we cannot parse helps nobody — the body is stored instead, to
 * be looked at.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = parseTumaCallback(body);

  if (!parsed.merchantRequestId) {
    await recordProblem({
      area: "payment",
      message: "A Tuma callback named no payment, so nothing could be credited.",
      detail: body,
    });
    return NextResponse.json({ received: true });
  }

  const payment = await findPaymentByMerchantRequest(parsed.merchantRequestId);
  if (!payment) {
    await recordProblem({
      area: "payment",
      message: "A Tuma callback named a payment we have no record of.",
      detail: { merchantRequestId: parsed.merchantRequestId, body },
    });
    return NextResponse.json({ received: true });
  }

  if (parsed.success) {
    await markPaymentSucceeded(payment.id, parsed.mpesaReceipt, body);
  } else {
    await markPaymentFailed(payment.id, body);
  }

  return NextResponse.json({ received: true });
}
