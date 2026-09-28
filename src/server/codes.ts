import "server-only";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/**
 * Emailed links and six-digit codes, for a head of institution acting
 * without an account. The link is 32 random bytes, stored hashed like a
 * password reset; the code is keyed, because six digits hashed plainly could
 * be read back from a leaked table in moments.
 */

export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

export function hashCode(scope: string, code: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set.");
  return createHmac("sha256", secret).update(`${scope}:${code}`).digest("hex");
}

export function codeMatches(stored: string | null, scope: string, code: string) {
  const expected = Buffer.from(stored ?? "", "hex");
  const given = Buffer.from(hashCode(scope, code.trim()), "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}
