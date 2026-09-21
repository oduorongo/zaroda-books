"use server";

import { headers } from "next/headers";
import { requestPasswordReset } from "@/server/password-reset";
import { SITE_URL } from "@/app/site-url";

/**
 * Always answers the same, whether or not the address has an account. The
 * alternative tells a stranger which schools keep books here.
 */
export async function forgotAction(_prev: string | null, form: FormData): Promise<string | null> {
  const email = String(form.get("email") ?? "").trim();
  if (!email.includes("@")) return "Enter your email address.";

  const h = await headers();
  const origin = h.get("host") ? `https://${h.get("host")}` : SITE_URL;
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  try {
    await requestPasswordReset(email, origin, ip);
  } catch {
    // Swallowed on purpose: a failure here must not reveal anything either.
  }
  return "SENT";
}
