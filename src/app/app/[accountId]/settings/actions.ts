"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { loadBook } from "@/server/book-context";
import { sendForAudit } from "@/server/audit-send";
import { isSubCountyOf, readHandover } from "@/domain";
import { db, schema } from "@/db";
import {
  archiveBook, changeAccountType, changeFinancialYear, saveSchool, saveSchoolLocation,
} from "@/server/books";
import type { AccountType } from "@/domain";

export async function changeFinancialYearAction(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  const { user } = await loadBook(accountId, { write: true, require: "financialYear.change" });

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

export async function changeAccountTypeAction(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  const { user } = await loadBook(accountId, { write: true, require: "financialYear.change" });

  const accountType = String(form.get("accountType") ?? "") as AccountType;
  if (!accountType) return "Choose the account type.";

  try {
    await changeAccountType({
      accountId, userId: user.id, orgId: user.orgId, accountType,
    });
  } catch (e) {
    return e instanceof Error ? e.message : "The account type could not be changed.";
  }

  revalidatePath("/app", "layout");
  return "Saved. The vote heads have been rebuilt for this account.";
}

export async function archiveBookAction(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  const { user, school } = await loadBook(accountId, { write: true, require: "book.archive" });

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
  const { school } = await loadBook(accountId, { write: true, require: "school.edit" });

  const county = String(form.get("county") ?? "").trim();
  const subCounty = String(form.get("subCounty") ?? "").trim();
  const placed = Boolean(county || subCounty);
  if (placed && !isSubCountyOf(county, subCounty)) {
    return "Choose the county and the sub-county together, or leave both blank.";
  }

  // The name input is disabled once entries are posted, so it does not post at
  // all. Its absence means leave the name alone, not clear it.
  const name = String(form.get("schoolName") ?? "").trim();

  try {
    await saveSchoolLocation(school.id, placed ? county : null, placed ? subCounty : null);
    if (name) await saveSchool(school.id, name);
  } catch (e) {
    const message = e instanceof Error ? e.message : "";
    return message.includes("schools_org_name")
      ? "Another school of this level in your books already has that name."
      : message || "The school could not be saved.";
  }

  revalidatePath("/app", "layout");
  return "Saved.";
}

export async function sendForAuditAction(_prev: string | null, form: FormData): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  try {
    await sendForAudit(accountId, String(form.get("grantId") ?? ""));
  } catch (e) {
    return e instanceof Error ? e.message : "The books could not be sent.";
  }
  revalidatePath(`/app/${accountId}`, "layout");
  return null;
}

/**
 * Records the head of institution handing the school over, for the auditor's
 * clearance memo. Each save is a new record; the latest is the one used.
 */
export async function saveHandoverAction(
  _prev: string | null,
  form: FormData,
): Promise<string | null> {
  const accountId = String(form.get("accountId") ?? "");
  const { user, school } = await loadBook(accountId, { write: true, require: "book.sendForAudit" });
  const h = readHandover(
    String(form.get("officer") ?? ""), String(form.get("tscNo") ?? ""),
    String(form.get("reason") ?? ""), String(form.get("handoverDate") ?? ""),
  );
  if ("error" in h) return h.error;
  await db.insert(schema.hoiHandovers).values({ schoolId: school.id, recordedBy: user.id, ...h });
  revalidatePath(`/app/${accountId}/settings`);
  return "Saved.";
}
