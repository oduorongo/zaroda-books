"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { createBook, type SchoolLevel } from "@/server/books";
import { CHART_OF_ACCOUNTS, type AccountType } from "@/domain";

const LEVELS: SchoolLevel[] = ["primary", "junior", "senior"];

export async function createBookAction(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const schoolName = String(form.get("schoolName") ?? "").trim();
  const level = String(form.get("level") ?? "") as SchoolLevel;
  const accountType = String(form.get("accountType") ?? "") as AccountType;
  const fyLabel = String(form.get("fyLabel") ?? "").trim();

  if (!schoolName) return "Enter the name of the school.";
  if (!LEVELS.includes(level)) return "Choose the school level.";
  if (!CHART_OF_ACCOUNTS[accountType]) return "Choose the account type.";
  if (!/^\d{4}\/\d{2}$/.test(fyLabel)) return "Choose the financial year.";

  const { account } = await createBook({
    orgId: user.orgId, schoolName, level, accountType, fyLabel,
  });

  redirect(`/app/${account.id}/receipts`);
}
