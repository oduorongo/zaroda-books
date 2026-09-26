"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { auditMail, escapeHtml, schoolContacts } from "@/server/audit-mail";
import { db, schema } from "@/db";
import { CLEARANCE_REASONS } from "@/domain";
import {
  auditedSchool, BOOKS_CHECKLIST, clearanceData, clearanceDefaults, ipsasData, latestHandover, myReport, parseClearance,
  PRIMARY_DEFAULTS, primaryData, sentYears,
  type ClearanceContent, type IpsasContent, type PrimaryContent,
} from "@/server/audit-reports";

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

  if (report.kind === "clearance") {
    const memo = parseClearance(report.content);
    if (!memo.officer || !memo.tscNo || !report.periodTo) {
      redirect(`/audit/reports/${report.id}?error=incomplete`);
    }
  }
  let figures: unknown;
  if (report.kind === "clearance") figures = await clearanceData(report.schoolId, user.name);
  else if (report.kind === "primary") {
    const data = await primaryData(report.schoolId, report.periodFrom!, report.periodTo!, report.auditorId, user.name);
    // Figures for days the books do not cover would be invented, so the
    // statements are not issued until the books cover the whole period.
    if (data.accounts.some((a) => !a.current.complete)) redirect(`/audit/reports/${report.id}?error=uncovered`);
    figures = data;
  } else figures = await ipsasData(report.schoolId, JSON.parse(report.years ?? "[]"), report.auditorId, user.name);
  await db.update(schema.auditReports)
    .set({ status: "issued", snapshot: JSON.stringify(figures), issuedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(schema.auditReports.id, report.id), eq(schema.auditReports.status, "draft")));
  await tellSchoolIssued(report, user.name);
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

/** Starts a clearance memo for a head of institution leaving the school. */
export async function createClearance(form: FormData) {
  const schoolId = String(form.get("schoolId") ?? "");
  const { user, scope, school } = await auditedSchool(schoolId);
  // Starts from the handover the school recorded, if any; the auditor can
  // change every particular before issuing.
  const handover = await latestHandover(schoolId);
  const content = {
    ...clearanceDefaults(school.county, school.subCounty),
    ...(handover ? { officer: handover.officer, tscNo: handover.tscNo, reason: handover.reason } : {}),
  };
  const [row] = await db.insert(schema.auditReports).values({
    kind: "clearance",
    auditorId: scope.id,
    authoredBy: user.id,
    schoolId,
    content: JSON.stringify(content),
    periodTo: handover?.handoverDate ?? null,
  }).returning({ id: schema.auditReports.id });
  redirect(`/audit/reports/${row.id}`);
}

/** Saves the memo's particulars and the date the clearance runs to. */
export async function saveClearance(form: FormData) {
  const { report } = await myReport(String(form.get("reportId") ?? ""));
  if (report.status !== "draft" || report.kind !== "clearance") redirect(`/audit/reports/${report.id}`);

  const reason = text(form, "reason");
  const content: ClearanceContent = {
    officer: text(form, "officer"),
    tscNo: text(form, "tscNo"),
    reason: (CLEARANCE_REASONS as readonly string[]).includes(reason) ? reason : "retirement",
    addressee: text(form, "addressee"),
    from: text(form, "from"),
    reference: text(form, "reference"),
    copyTo: text(form, "copyTo"),
  };
  const periodTo = text(form, "periodTo") || null;

  await db.update(schema.auditReports)
    .set({ content: JSON.stringify(content), periodTo, updatedAt: new Date() })
    .where(eq(schema.auditReports.id, report.id));
  revalidatePath(`/audit/reports/${report.id}`);
  redirect(`/audit/reports/${report.id}?saved=1`);
}

/** Starts audited financial statements for the period the auditor sets. */
export async function createPrimary(form: FormData) {
  const schoolId = String(form.get("schoolId") ?? "");
  const { user, scope } = await auditedSchool(schoolId);
  const from = text(form, "from");
  const to = text(form, "to");
  const iso = /^d{4}-d{2}-d{2}$/;
  if (!iso.test(from) || !iso.test(to) || from > to) redirect(`/audit/schools/${schoolId}?error=period`);

  const handover = await latestHandover(schoolId);
  const content: PrimaryContent = {
    ...PRIMARY_DEFAULTS,
    ...(handover ? { headTeacher: handover.officer, tscNo: handover.tscNo } : {}),
  };
  const [row] = await db.insert(schema.auditReports).values({
    kind: "primary",
    auditorId: scope.id,
    authoredBy: user.id,
    schoolId,
    periodFrom: from,
    periodTo: to,
    content: JSON.stringify(content),
  }).returning({ id: schema.auditReports.id });
  redirect(`/audit/reports/${row.id}`);
}

/** Saves what the auditor wrote on the statements. */
export async function savePrimary(form: FormData) {
  const { report } = await myReport(String(form.get("reportId") ?? ""));
  if (report.status !== "draft" || report.kind !== "primary") redirect(`/audit/reports/${report.id}`);
  const content: PrimaryContent = {
    headTeacher: text(form, "headTeacher"),
    tscNo: text(form, "tscNo"),
    zone: text(form, "zone"),
    certificate: text(form, "certificate"),
    procurement: text(form, "procurement"),
    management: text(form, "management"),
    books: Object.fromEntries(BOOKS_CHECKLIST.map((item, i) => [item, text(form, `book_${i}`)])),
  };
  await db.update(schema.auditReports)
    .set({ content: JSON.stringify(content), updatedAt: new Date() })
    .where(eq(schema.auditReports.id, report.id));
  revalidatePath(`/audit/reports/${report.id}`);
  redirect(`/audit/reports/${report.id}?saved=1`);
}

const KIND = { ipsas: "an internal audit report", primary: "audited financial statements", clearance: "a clearance memo" };

/** The school hears as soon as a report on it is issued, with a link to open it. */
async function tellSchoolIssued(report: typeof schema.auditReports.$inferSelect, auditor: string) {
  const [school] = await db.select().from(schema.schools).where(eq(schema.schools.id, report.schoolId));
  const [book] = await db.select({ id: schema.accounts.id }).from(schema.accounts)
    .where(and(eq(schema.accounts.schoolId, report.schoolId), isNull(schema.accounts.archivedAt))).limit(1);
  if (!school || !book) return;
  await auditMail(await schoolContacts(school.orgId, school.id), {
    subject: `Audit: ${KIND[report.kind]} issued on ${school.name}`,
    heading: "The auditor has issued " + KIND[report.kind],
    body: `<strong>${escapeHtml(auditor)}</strong>, Ministry auditor, has issued ${KIND[report.kind]} on `
      + `<strong>${escapeHtml(school.name)}</strong>. You can open and print it from Book settings.`,
    buttonLabel: "Open it",
    linkPath: `/app/${book.id}/audit-reports/${report.id}`,
  });
}
