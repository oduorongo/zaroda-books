"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { POSITIONS, type Position, type SchoolLevel } from "@/domain";
import { startViewAs } from "@/server/auth";
import {
  createSubscription,
  requirePlatformAdmin,
  setOrgApproved,
  setSubscriptionStatus,
  setUserPosition,
  type SubscriptionStatus,
  unbindSubscription,
} from "@/server/platform";

const message = (e: unknown) =>
  e instanceof Error ? e.message : "That could not be done.";

export async function setStatusAction(_prev: string | null, form: FormData): Promise<string | null> {
  const orgId = String(form.get("orgId") ?? "");
  const status = String(form.get("status") ?? "");
  if (!["paid", "unpaid", "free"].includes(status)) return "Choose paid, unpaid or free.";
  try {
    await setSubscriptionStatus(String(form.get("subscriptionId") ?? ""), status as SubscriptionStatus);
  } catch (e) {
    return message(e);
  }
  revalidatePath(`/admin/${orgId}`);
  revalidatePath("/admin");
  return null;
}

export async function createSubscriptionAction(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const orgId = String(form.get("orgId") ?? "");
  const level = String(form.get("level") ?? "") as SchoolLevel;
  const fyLabel = String(form.get("fyLabel") ?? "").trim();

  if (!["primary", "junior", "senior"].includes(level)) return "Choose the school level.";
  if (!/^\d{4}\/\d{2}$/.test(fyLabel)) return "Give the financial year as 2025/26.";

  try {
    await createSubscription(orgId, level, fyLabel, form.get("paid") === "yes");
  } catch (e) {
    return message(e);
  }
  revalidatePath(`/admin/${orgId}`);
  return null;
}

export async function unbindAction(_prev: string | null, form: FormData): Promise<string | null> {
  const orgId = String(form.get("orgId") ?? "");
  try {
    await unbindSubscription(
      String(form.get("subscriptionId") ?? ""),
      String(form.get("reason") ?? ""),
    );
  } catch (e) {
    return message(e);
  }
  revalidatePath(`/admin/${orgId}`);
  return null;
}

export async function setPositionAction(_prev: string | null, form: FormData): Promise<string | null> {
  const orgId = String(form.get("orgId") ?? "");
  const position = String(form.get("position") ?? "");
  if (position && !POSITIONS.includes(position as Position)) return "Choose a role.";
  try {
    await setUserPosition(orgId, String(form.get("userId") ?? ""), (position || null) as Position | null);
  } catch (e) {
    return message(e);
  }
  revalidatePath(`/admin/${orgId}`);
  return null;
}

export async function viewAsAction(form: FormData) {
  await requirePlatformAdmin();
  const orgId = String(form.get("orgId") ?? "");
  await startViewAs(orgId);
  redirect("/app");
}

export async function setApprovedAction(_prev: string | null, form: FormData): Promise<string | null> {
  const orgId = String(form.get("orgId") ?? "");
  try {
    await setOrgApproved(orgId, form.get("approved") === "yes");
  } catch (e) {
    return message(e);
  }
  revalidatePath(`/admin/${orgId}`);
  revalidatePath("/admin");
  return null;
}
