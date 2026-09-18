"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { loadBook } from "@/server/book-context";
import { archiveBook, changeFinancialYear, saveSchool } from "@/server/books";

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

export async function archiveBookAction(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  const { user, school } = await loadBook(accountId);

  // Typing the school's name is the confirmation: a book holds a year of work,
  // and a stray click should not be able to take it out of the list.
  const typed = String(form.get("confirm") ?? "").trim();
  if (typed.toLowerCase() !== school.name.trim().toLowerCase()) {
    return `Type the school's name exactly — ${school.name} — to archive this book.`;
  }

  try {
    await archiveBook({ accountId, orgId: user.orgId, userId: user.id });
  } catch (e) {
    return e instanceof Error ? e.message : "The book could not be archived.";
  }

  revalidatePath("/app", "layout");
  redirect("/app/new");
}

export async function saveSchoolAction(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  const { school } = await loadBook(accountId);

  const name = String(form.get("schoolName") ?? "").trim();
  if (!name) return "Enter the name of the school.";

  try {
    await saveSchool(school.id, name);
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    return message.includes("schools_org_name")
      ? "Another school of this level in your books already has that name."
      : message || "The school could not be saved.";
  }

  revalidatePath("/app", "layout");
  return "Saved.";
}
