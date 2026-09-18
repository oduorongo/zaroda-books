"use server";

import { revalidatePath } from "next/cache";
import { loadBook } from "@/server/book-context";
import { changeFinancialYear } from "@/server/books";

export async function changeFinancialYearAction(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  const { user } = await loadBook(accountId);

  const fyLabel = String(form.get("fyLabel") ?? "").trim();
  if (!/^\d{4}\/\d{2}$/.test(fyLabel)) return "Choose the financial year.";

  try {
    await changeFinancialYear({
      accountId, userId: user.id, orgId: user.orgId, fyLabel,
    });
  } catch (e) {
    return e instanceof Error ? e.message : "The financial year could not be changed.";
  }

  revalidatePath(`/app/${accountId}`, "layout");
  return `Saved. This book now runs for ${fyLabel}.`;
}
