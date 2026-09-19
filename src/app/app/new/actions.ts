"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { createBook } from "@/server/books";
import { chartFor, type AccountType, type SchoolLevel } from "@/domain";

const LEVELS: SchoolLevel[] = ["primary", "junior", "senior"];

export async function createBookAction(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.readOnly) return "You are viewing these books as the system owner. Nothing can be created from here.";

  const schoolName = String(form.get("schoolName") ?? "").trim();
  const level = String(form.get("level") ?? "") as SchoolLevel;
  const accountType = String(form.get("accountType") ?? "") as AccountType;
  const fyLabel = String(form.get("fyLabel") ?? "").trim();

  if (!schoolName) return "Enter the name of the school.";
  if (!LEVELS.includes(level)) return "Choose the school level.";
  if (!chartFor(level, accountType)) return "Choose an account kept at that school level.";
  if (!/^\d{4}\/\d{2}$/.test(fyLabel)) return "Choose the financial year.";

  let account;
  try {
    ({ account } = await createBook({
      orgId: user.orgId, schoolName, level, accountType, fyLabel,
    }));
  } catch (e) {
    return e instanceof Error ? e.message : "The book could not be created.";
  }

  redirect(`/app/${account.id}/receipts`);
}
