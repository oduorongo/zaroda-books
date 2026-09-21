"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/server/auth";
import { pollPayment, startSubscriptionPayment } from "@/server/billing";
import { can, type SchoolLevel } from "@/domain";

const LEVELS: SchoolLevel[] = ["primary", "junior", "senior"];

export async function payAction(_prev: string | null, form: FormData): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.readOnly) return "You are viewing these books as the system owner. Nothing can be paid from here.";
  if (!can(user.role, "subscription.pay")) {
    return "Only the owner of these books can pay the subscription.";
  }

  const level = String(form.get("level") ?? "") as SchoolLevel;
  const fyLabel = String(form.get("fyLabel") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();

  if (!LEVELS.includes(level)) return "Choose the school level.";
  if (!/^\d{4}\/\d{2}$/.test(fyLabel)) return "Choose the financial year.";

  const result = await startSubscriptionPayment({
    orgId: user.orgId, userId: user.id, level, fyLabel, phone,
  });
  if (!result.ok) return result.error;

  revalidatePath("/app/subscribe");
  redirect(`/app/subscribe/${result.paymentId}`);
}

/** Called by the waiting page while the customer is at the PIN prompt. */
export async function checkAction(paymentId: string): Promise<string> {
  const user = await getCurrentUser();
  if (!user) return "unknown";
  const { status } = await pollPayment(paymentId, user.orgId);
  if (status === "success") revalidatePath("/app", "layout");
  return status;
}
