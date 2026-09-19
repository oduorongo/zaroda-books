import "server-only";

/**
 * Tuma (https://tuma.co.ke) payment gateway client — M-Pesa STK push for the
 * Zaroda Books subscription. Ported from ZARODA SMS, where it was built and
 * hardened against live traffic.
 *
 * There is no public API reference for Tuma: their "API Docs" link points at
 * their blog. This client came from their example Postman collection, which
 * shows request shapes but neither response schemas nor the webhook payload.
 * Response reading is therefore deliberately permissive, and every raw body is
 * stored by the caller so real payloads can be inspected and this tightened.
 *
 * Env: TUMA_EMAIL, TUMA_API_KEY.
 */

const TUMA_BASE = "https://api.tuma.co.ke";

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

/**
 * Read a JWT's exp claim without verifying the signature. The token is opaque
 * to us; we only need to know when to ask for another one.
 */
function jwtExpiry(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const payload = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

async function getToken(): Promise<string> {
  const email = process.env.TUMA_EMAIL;
  const apiKey = process.env.TUMA_API_KEY;
  if (!email || !apiKey) throw new Error("Tuma is not configured (TUMA_EMAIL / TUMA_API_KEY).");

  const cached = tokenCache.get(email);
  if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;

  const resp = await fetch(`${TUMA_BASE}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, api_key: apiKey }),
  });
  const data = await resp.json().catch(() => ({})) as Record<string, never>;
  if (!resp.ok) {
    throw new Error(`Tuma auth failed (${resp.status}): ${JSON.stringify(data).slice(0, 300)}`);
  }

  const d = data as Record<string, unknown>;
  const nested = (d.data ?? {}) as Record<string, unknown>;
  const token = (d.token ?? d.access_token ?? d.jwt
    ?? nested.token ?? nested.access_token ?? nested.jwt) as string | undefined;
  if (!token) throw new Error(`Tuma auth response had no token: ${JSON.stringify(data).slice(0, 300)}`);

  // Their sample tokens last 24h; fall back to 23h if exp cannot be read.
  tokenCache.set(email, {
    token,
    expiresAt: jwtExpiry(token) ?? Date.now() + 23 * 60 * 60 * 1000,
  });
  return token;
}

export interface StkPushResult {
  ok: boolean;
  merchantRequestId?: string;
  raw?: unknown;
  detail?: string;
}

/** Amount is whole shillings — Tuma does not take cents. */
export async function initiateStkPush(opts: {
  amountShillings: number;
  phone: string;
  description: string;
  callbackUrl: string;
}): Promise<StkPushResult> {
  // A Cloudflare-fronted 5xx (522, "connection timed out", is the one actually
  // seen in production) means Tuma's own backend did not answer in time. It is
  // a transient blip rather than anything about this request, and one retry
  // clears most of them without the customer re-requesting the PIN prompt.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const token = await getToken();
      const resp = await fetch(`${TUMA_BASE}/payment/stk-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          amount: opts.amountShillings,
          phone: opts.phone,
          callback_url: opts.callbackUrl,
          description: opts.description,
        }),
      });
      const data = await resp.json().catch(() => ({})) as Record<string, unknown>;

      if (!resp.ok) {
        if (resp.status >= 500 && attempt === 0) {
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        const message = data.message;
        const friendly = resp.status >= 500
          ? "The M-Pesa payment service is unavailable for a moment. Try again shortly."
          : (Array.isArray(message) ? message.join(", ") : message as string)
            || `The payment request failed (${resp.status}).`;
        return { ok: false, raw: data, detail: friendly };
      }

      const nested = (data.data ?? {}) as Record<string, unknown>;
      const merchantRequestId = (data.merchant_request_id ?? data.MerchantRequestID
        ?? nested.merchant_request_id ?? nested.MerchantRequestID) as string | undefined;
      return { ok: true, merchantRequestId, raw: data };
    } catch (err) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      return {
        ok: false,
        detail: err instanceof Error ? err.message
          : "Could not reach the M-Pesa payment service. Try again.",
      };
    }
  }
  return { ok: false, detail: "Could not reach the M-Pesa payment service. Try again." };
}

export interface PaymentStatusResult {
  ok: boolean;
  status?: string;
  mpesaReceipt?: string;
  raw?: unknown;
  detail?: string;
}

/** Used when the webhook never arrives, which happens. */
export async function checkPaymentStatus(merchantRequestId: string): Promise<PaymentStatusResult> {
  try {
    const token = await getToken();
    const resp = await fetch(`${TUMA_BASE}/payment/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ merchant_request_id: merchantRequestId }),
    });
    const data = await resp.json().catch(() => ({})) as Record<string, unknown>;
    if (!resp.ok) {
      return {
        ok: false,
        raw: data,
        detail: `Tuma status check failed (${resp.status}): ${JSON.stringify(data).slice(0, 300)}`,
      };
    }
    const status = (data.status ?? data.Status ?? data.result_desc ?? data.ResultDesc) as string | undefined;
    const mpesaReceipt = (data.mpesa_receipt ?? data.MpesaReceiptNumber
      ?? data.receipt_number) as string | undefined;
    return { ok: true, status, mpesaReceipt, raw: data };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : "Tuma status check failed." };
  }
}

/** Where Tuma should call back. Must be publicly reachable — not localhost. */
export function tumaCallbackUrl(): string {
  const base = (
    process.env.APP_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
    || "http://localhost:3000"
  ).replace(/\/+$/, "");
  return `${base}/api/tuma/callback`;
}
