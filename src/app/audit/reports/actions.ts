"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { auditedSchool, ipsasData, myReport, sentYears, type IpsasContent } from "@/server/audit-reports";

/** Starts an IPSAS report on the years ticked, from the books sent to this auditor. */
export async function createIpsasReport(form: FormData) {
  const schoolId = String(form.get("schoolId") ?? "");
  const { user, scope, sent } = await auditedSchool(schoolId);
  const offered = await sentYears(sent.map((a) => a.id));
  const years = form.getAll("year").map(String).filter((y) => offered.includes(y));
  if (!years.length) redirect(`/audit/schools/${schoolId}?error=years`);

  const [row] = await db.insert(schema.auditReports).values({
    kind: "ipsas",
    auditorId: scope.id,
    authoredBy: user.id,
    schoolId,
    years: JSON.stringify(years.sort()),
  }).returning({ id: schema.auditReports.id });
  redirect(`/audit/reports/${row.id}`);
}

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

/** Saves what the auditor wrote. The figures are never part of this. */
export async function saveIpsasContent(form: FormData) {
  const { report } = await myReport(String(form.get("reportId") ?? ""));
  if (report.status !== "draft") redirect(`/audit/reports/${report.id}`);

  const content: IpsasContent = {
    summary: text(form, "summary"),
    objectives: text(form, "objectives"),
    scope: text(form, "scope"),
    methodology: text(form, "methodology"),
    strengths: text(form, "strengths"),
    weaknesses: text(form, "weaknesses"),
    effectiveness: text(form, "effectiveness"),
    recommendations: form.getAll("issue").map((_, i) => ({
      issue: String(form.getAll("issue")[i] ?? "").trim(),
      comments: String(form.getAll("comments")[i] ?? "").trim(),
      who: String(form.getAll("who")[i] ?? "").trim(),
      timeframe: String(form.getAll("timeframe")[i] ?? "").trim(),
    })).filter((r) => r.issue),
  };

  await db.update(schema.auditReports)
    .set({ content: JSON.stringify(content), updatedAt: new Date() })
    .where(eq(schema.auditReports.id, report.id));
  revalidatePath(`/audit/reports/${report.id}`);
  redirect(`/audit/reports/${report.id}?saved=1`);
}

/**
 * Issues the report: the figures as they stand are frozen into it, and from
 * then on neither they nor the auditor's text change.
 */
export async function issueReport(form: FormData) {
  const { user, report } = await myReport(String(form.get("reportId") ?? ""));
  if (report.status !== "draft") redirect(`/audit/reports/${report.id}`);
  // The books must still be sent: an issued report is only as good as the
  // books it was drawn from, and a taken-back book may be changing.
  await auditedSchool(report.schoolId);

  const figures = await ipsasData(report.schoolId, JSON.parse(report.years ?? "[]"), report.auditorId, user.name);
  await db.update(schema.auditReports)
    .set({ status: "issued", snapshot: JSON.stringify(figures), issuedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(schema.auditReports.id, report.id), eq(schema.auditReports.status, "draft")));
  revalidatePath(`/audit/reports/${report.id}`);
  redirect(`/audit/reports/${report.id}`);
}

/** Discards a draft. An issued report is never deleted. */
export async function deleteDraft(form: FormData) {
  const { report } = await myReport(String(form.get("reportId") ?? ""));
  if (report.status === "draft") {
    await db.delete(schema.auditReports).where(eq(schema.auditReports.id, report.id));
  }
  redirect(`/audit/schools/${report.schoolId}`);
}
