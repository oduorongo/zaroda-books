"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { SITE_URL } from "@/app/site-url";
import type { Role } from "@/domain";
import { changeRole, inviteToOrg, removeFromOrg, revokeInvite } from "@/server/people";

const message = (e: unknown) => (e instanceof Error ? e.message : "That could not be done.");

/**
 * Returns the code rather than emailing it: there is no mail service yet, so
 * the owner passes it on themselves, usually by WhatsApp.
 */
export async function inviteAction(_prev: string | null, form: FormData): Promise<string | null> {
  try {
    const schoolId = String(form.get("schoolId") ?? "").trim();
    const h = await headers();
    const origin = h.get("host") ? `https://${h.get("host")}` : SITE_URL;

    const { code, emailed } = await inviteToOrg(
      String(form.get("email") ?? ""),
      String(form.get("role") ?? "") as Role,
      schoolId || null,
      origin,
    );
    revalidatePath("/app/people");
    // The link comes back whether or not the email went, so a failure there
    // never leaves the owner with no way to invite anyone.
    return `CODE:${emailed ? "sent" : "unsent"}:${code}`;
  } catch (e) {
    return message(e);
  }
}

export async function revokeInviteAction(_prev: string | null, form: FormData) {
  try {
    await revokeInvite(String(form.get("invitationId") ?? ""));
  } catch (e) {
    return message(e);
  }
  revalidatePath("/app/people");
  return null;
}

export async function changeRoleAction(_prev: string | null, form: FormData) {
  try {
    await changeRole(String(form.get("userId") ?? ""), String(form.get("role") ?? "") as Role);
  } catch (e) {
    return message(e);
  }
  revalidatePath("/app", "layout");
  return null;
}

export async function removeAction(_prev: string | null, form: FormData) {
  try {
    await removeFromOrg(String(form.get("userId") ?? ""));
  } catch (e) {
    return message(e);
  }
  revalidatePath("/app/people");
  return null;
}
