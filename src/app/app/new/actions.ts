"use server";

import { redirect } from "next/navigation";
import { getCurrentUser, isPlatformAdmin } from "@/server/auth";
import { createBook, orgEntitlements } from "@/server/books";
import { startSubscriptionPayment } from "@/server/billing";
import { can, chartFor, type AccountType, type SchoolLevel } from "@/domain";

const LEVELS: SchoolLevel[] = ["primary", "junior", "senior"];

export async function createBookAction(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.readOnly) return "You are viewing these books as the system owner. Nothing can be created from here.";
  if (!can(user.role, "book.create")) {
    return "Only the owner of these books can open a new one. Ask them to add it.";
  }

  const schoolName = String(form.get("schoolName") ?? "").trim();
  const level = String(form.get("level") ?? "") as SchoolLevel;
  const accountType = String(form.get("accountType") ?? "") as AccountType;
  const fyLabel = String(form.get("fyLabel") ?? "").trim();

  if (!schoolName) return "Enter the name of the school.";
  if (!LEVELS.includes(level)) return "Choose the school level.";
  if (!chartFor(level, accountType)) return "Choose an account kept at that school level.";
  if (!/^\d{4}\/\d{2}$/.test(fyLabel)) return "Choose the financial year.";

  const isOwner = await isPlatformAdmin(user.id);

  // Paying happens here rather than on a page of its own, so the level and the
  // year that get paid for are the ones just typed. Choosing them twice is how
  // a bursar buys a primary subscription for a junior book.
  const { covered, freeUsed } = await orgEntitlements(user.orgId);
  const alreadyCovered = covered.some((c) => c.level === level && c.fyLabel === fyLabel);

  // freeUsed matters as much as covered: a tenant who still has their free
  // school owes nothing, and asking them to pay would quietly sell them what
  // they were promised for nothing. createBook grants it, and refuses if the
  // account has not been approved yet.
  if (!isOwner && !alreadyCovered && freeUsed) {
    const phone = String(form.get("phone") ?? "").trim();
    if (!phone) return "NEEDS_PAYMENT";

    const started = await startSubscriptionPayment({
      orgId: user.orgId,
      userId: user.id,
      level,
      fyLabel,
      phone,
      pendingBook: { schoolName, accountType },
    });
    if (!started.ok) return started.error;
    redirect(`/app/subscribe/${started.paymentId}`);
  }

  let account;
  try {
    ({ account } = await createBook({
      orgId: user.orgId, schoolName, level, accountType, fyLabel,
      // Zaroda Solutions keeping its own books, checked against the table
      // rather than taken from the session.
      bypassEntitlement: isOwner,
    }));
  } catch (e) {
    return e instanceof Error ? e.message : "The book could not be created.";
  }

  redirect(`/app/${account.id}/receipts`);
}
