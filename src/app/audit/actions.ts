"use server";

import { redirect } from "next/navigation";
import { startViewAs } from "@/server/auth";
import { beginAuditOf } from "@/server/audit";

/**
 * Opens a school's books. The session becomes read-only and narrowed to the
 * auditor's area, so the ordinary book pages serve them unchanged and there
 * is no second set of report pages to keep in step.
 */
export async function openSchoolAction(form: FormData) {
  const schoolId = String(form.get("schoolId") ?? "");
  const accountId = String(form.get("accountId") ?? "");

  const row = await beginAuditOf(schoolId);
  await startViewAs(row.org.id);

  redirect(accountId ? `/app/${accountId}/cash-book` : "/app");
}
