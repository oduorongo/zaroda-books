/**
 * The parts of the Tuma payment gateway that are pure: phone formatting and
 * reading a callback body. Ported from ZARODA SMS (backend/src/common/tuma.ts),
 * where they were learned against live traffic.
 *
 * They live in the domain because Tuma publish no API reference — their "API
 * Docs" link goes to their blog — so the field names below are inference from
 * a Postman collection and from real callbacks. Inference that decides whether
 * money arrived belongs where it can be tested without a network.
 */

/**
 * Tuma's STK push wants a bare 2547XXXXXXXX, no plus sign. Null for anything
 * that is not a Kenyan mobile: pushing to a wrong number asks a stranger to
 * pay, so a guess is worse than a refusal.
 */
export function normalisePhoneForTuma(raw: string): string | null {
  if (!raw) return null;
  const p = String(raw).replace(/\D/g, "");
  if (p.startsWith("0") && p.length === 10 && /^0(7|1)/.test(p)) return `254${p.slice(1)}`;
  if (p.startsWith("254") && p.length === 12 && /^254(7|1)/.test(p)) return p;
  if (p.length === 9 && /^(7|1)/.test(p)) return `254${p}`;
  return null;
}

export interface TumaCallback {
  merchantRequestId?: string;
  success: boolean;
  mpesaReceipt?: string;
}

/**
 * Best-effort read of a callback body, checking every field spelling seen so
 * far. Anything it cannot make sense of is treated as NOT paid: an unrecorded
 * payment gets chased, a wrongly credited one puts money in the books that
 * never arrived.
 */
export function parseTumaCallback(body: unknown): TumaCallback {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const data = (b.data && typeof b.data === "object" ? b.data : {}) as Record<string, unknown>;
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      if (b[k] !== undefined && b[k] !== null) return b[k];
      if (data[k] !== undefined && data[k] !== null) return data[k];
    }
    return undefined;
  };

  const merchantRequestId = pick("merchant_request_id", "MerchantRequestID");
  const resultCode = pick("result_code", "ResultCode");
  const status = String(pick("status", "Status") ?? "").toLowerCase();
  // mpesa_receipt_number is the one Tuma actually sends — confirmed against a
  // live callback. The others stay as fallbacks: nothing documents the shape,
  // so a spelling seen once is not a promise.
  const mpesaReceipt = pick(
    "mpesa_receipt_number", "mpesa_receipt", "MpesaReceiptNumber", "receipt_number",
  );

  const success = resultCode === 0 || resultCode === "0"
    || status === "success" || status === "completed";

  return {
    merchantRequestId: merchantRequestId === undefined ? undefined : String(merchantRequestId),
    success,
    mpesaReceipt: mpesaReceipt === undefined ? undefined : String(mpesaReceipt),
  };
}
