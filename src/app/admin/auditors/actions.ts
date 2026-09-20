"use server";

import { revalidatePath } from "next/cache";
import { isSubCountyOf, isCounty } from "@/domain";
import { grantAuditor, revokeAuditor } from "@/server/platform";

const message = (e: unknown) => (e instanceof Error ? e.message : "That could not be done.");

export async function grantAuditorAction(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const email = String(form.get("email") ?? "").trim();
  const county = String(form.get("county") ?? "").trim();
  const subCounty = String(form.get("subCounty") ?? "").trim();

  if (!email) return "Enter the auditor's email address.";
  if (!isCounty(county)) return "Choose a county.";
  // Blank sub-county is the whole county, which is a real grant and much
  // wider — so it has to be chosen, not arrived at by leaving a box empty.
  if (subCounty && !isSubCountyOf(county, subCounty)) {
    return "That sub-county is not in that county.";
  }

  try {
    await grantAuditor(email, county, subCounty || null);
  } catch (e) {
    return message(e);
  }
  revalidatePath("/admin/auditors");
  return null;
}

export async function revokeAuditorAction(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  try {
    await revokeAuditor(String(form.get("auditorId") ?? ""));
  } catch (e) {
    return message(e);
  }
  revalidatePath("/admin/auditors");
  return null;
}
