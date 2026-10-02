import { NextResponse } from "next/server";
import { parseTumaCallback, tumaStatusIsSuccess } from "@/domain";
import { recordProblem } from "@/server/problems";
import { checkPaymentStatus } from "@/server/tuma";
import {
  findPaymentByMerchantRequest, markPaymentFailed, markPaymentSucceeded,
} from "@/server/billing";

/**
 * Tuma calls this server-to-server with no session, so it cannot be behind
 * auth. The body carries no instruction: the amount and what it buys come
 * from the row we wrote when the push went out. And a callback saying the
 * money arrived is not believed on its own word — Tuma is asked first, so a
 * forged one cannot settle a payment that was never made.
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
    const confirmed = await checkPaymentStatus(parsed.merchantRequestId);
    if (!confirmed.ok || !tumaStatusIsSuccess(confirmed.status)) {
      // Left pending, not failed: if the money did arrive, the waiting page's
      // own check with Tuma credits it.
      await recordProblem({
        area: "payment",
        message: "A callback said a payment succeeded but Tuma did not confirm it, so nothing was credited.",
        detail: { merchantRequestId: parsed.merchantRequestId, body, tuma: confirmed.raw ?? confirmed.detail },
      });
      return NextResponse.json({ received: true });
    }
    await markPaymentSucceeded(payment.id, parsed.mpesaReceipt ?? confirmed.mpesaReceipt, body);
  } else {
    await markPaymentFailed(payment.id, body);
  }

  return NextResponse.json({ received: true });
}
