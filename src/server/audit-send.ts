import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  auditBlockReason, auditorCanSee, closedThrough, handoverCutoff, missingDocumentsWarning, statementGaps, scdeAuditBlock, statementsAuditBlock, takesProject, yearClosed,
  type AccountType, type Placed,
} from "@/domain";
import { loadBook } from "@/server/book-context";
import { unauthorisedVouchers } from "@/server/authorisation";
import { documentsFor, monthsWithoutStatement, paymentsWithoutScde } from "@/server/documents";
import { monthName } from "@/server/periods";
import { getTxns } from "@/server/queries";
import { latestHandover } from "@/server/audit-reports";
import { emailLayout, sendEmail } from "@/server/email";
import { SITE_URL } from "@/app/site-url";

/**
 * A school sends a closed year to one auditor covering it; until then no
 * auditor sees the book. Reopening a month takes it back — see period-close.ts.
 */

/** The auditors whose area covers this school, for the school to choose from. */
export async function auditorsForSchool(school: Placed) {
  const grants = await db
    .select({ grant: schema.auditors, name: schema.users.name, email: schema.users.email })
    .from(schema.auditors)
    .innerJoin(schema.users, eq(schema.users.id, schema.auditors.userId))
    .where(isNull(schema.auditors.revokedAt));
  return grants.filter((g) => auditorCanSee(g.grant, school));
}

/**
 * Sends the book: the whole closed year, or, while a head hands over, the
 * months up to the end of the handover month for the outgoing head's
 * clearance. Either way, reopening a month takes it back.
 */
export async function sendForAudit(accountId: string, grantId: string, scope: "year" | "handover" = "year") {
  const { user, fy, school, account } = await loadBook(accountId, { write: true, require: "book.sendForAudit" });

  const periods = await db.select().from(schema.periods).where(eq(schema.periods.financialYearId, fy.id));
  let upTo: string | null = null;
  let handover: typeof schema.hoiHandovers.$inferSelect | null = null;
  if (scope === "handover") {
    handover = await latestHandover(school.id);
    upTo = handover ? handoverCutoff(handover.handoverDate, periods) : null;
    if (!handover || !upTo) throw new Error("Record the head of institution handing over, in this book's year, first.");
    if (!closedThrough(periods, upTo)) {
      throw new Error(`Close every month up to ${monthName(`${upTo}-01`)} before sending the handover audit.`);
    }
  } else if (!yearClosed(periods)) {
    throw new Error("Close the year, up to June, before sending the books for audit.");
  }
  const { blocked } = await auditChecks(account, school.id, fy.id, upTo ?? undefined);
  if (blocked) throw new Error(blocked);

  const [chosen] = await db
    .select({ grant: schema.auditors, email: schema.users.email })
    .from(schema.auditors)
    .innerJoin(schema.users, eq(schema.users.id, schema.auditors.userId))
    .where(and(eq(schema.auditors.id, grantId), isNull(schema.auditors.revokedAt)));
  if (!chosen || !auditorCanSee(chosen.grant, school)) throw new Error("Choose an auditor who covers this school.");

  await db.batch([
    db.update(schema.accounts)
      .set({ auditSentTo: grantId, auditSentAt: new Date(), auditSentBy: user.id, auditUpTo: upTo })
      .where(eq(schema.accounts.id, accountId)),
    db.insert(schema.auditLog).values({
      orgId: user.orgId, userId: user.id, action: "audit.sent", entity: "account", entityId: accountId,
      before: JSON.stringify({ auditSentTo: account.auditSentTo, auditUpTo: account.auditUpTo }),
      after: JSON.stringify({ auditSentTo: grantId, fy: fy.label, auditUpTo: upTo }),
    }),
  ] as unknown as Parameters<typeof db.batch>[0]);

  const book = `${school.name} — ${account.name} ${fy.label}`.replace(/</g, "&lt;");
  const what = upTo && handover
    ? `has been closed up to ${monthName(`${upTo}-01`)} and sent to you for a handover audit: `
      + `${handover.officer.replace(/</g, "&lt;")} (TSC ${handover.tscNo.replace(/</g, "&lt;")}) is leaving on `
      + `${handover.reason}, handing over on ${handover.handoverDate}.`
    : "has been closed and sent to you for audit.";
  const url = `${SITE_URL}/audit`;
  try {
    await sendEmail({
      to: chosen.email,
      subject: upTo ? `${school.name} has sent its books for a handover audit` : `${school.name} has sent its books for audit`,
      html: emailLayout({
        heading: upTo ? "Books sent for a handover audit" : "Books sent for audit",
        body: `<strong>${book}</strong> ${what}`,
        buttonLabel: "Open your audit list",
        buttonUrl: url,
        footer: "Sent by Zaroda Books because a school chose you as its auditor.",
      }),
      text: `${book} ${what.replace(/<[^>]+>/g, "")}

Open your audit list: ${url}`,
    });
  } catch {
    // sendEmail records its own problems; the books are sent either way.
  }
}

/**
 * What stops a book going for audit — payments the head has not authorised,
 * infrastructure payments without an SCDE approval, and no bank statement for
 * the year's last month — and what only warns: payments with no supporting
 * documents, and statements for other months. A handover audit looks only at
 * the months it covers, and requires no statement at all.
 * Exempt books predate all of this.
 */
async function auditChecks(
  account: { id: string; type: string; authorisationExempt: boolean }, schoolId: string, fyId: string, upTo?: string,
) {
  if (account.authorisationExempt) return { blocked: null, warning: null };
  const unauthorised = auditBlockReason(await unauthorisedVouchers(fyId, upTo));
  const scde = takesProject(account.type as AccountType)
    ? scdeAuditBlock(await paymentsWithoutScde(account.id, schoolId, fyId, upTo)) : null;
  const periods = await db.select({ month: schema.periods.month }).from(schema.periods)
    .where(eq(schema.periods.financialYearId, fyId));
  const lastMonth = periods.map((p) => p.month.slice(0, 7)).sort().at(-1) ?? "";
  const gaps = statementGaps(await monthsWithoutStatement(account.id, fyId, upTo), lastMonth, Boolean(upTo));
  const named = (months: string[]) => months.map((m) => monthName(`${m}-01`));
  const statements = statementsAuditBlock(named(gaps.required));
  const statementsAsked = gaps.optional.length
    ? `No bank statement is attached for ${named(gaps.optional).join(", ")}. The auditor may ask for ${gaps.optional.length === 1 ? "it" : "them"}.`
    : null;
  const blocked = [
    unauthorised && `${unauthorised} Have the head authorise them from Payments first.`,
    scde && `${scde} Attach the approvals under Projects.`,
    statements,
  ].filter(Boolean).join(" ") || null;

  const payments = (await getTxns(fyId)).filter((t) => t.kind === "payment" && (!upTo || t.date.slice(0, 7) <= upTo));
  const docs = await documentsFor(payments.map((p) => p.id));
  const warning = [
    missingDocumentsWarning(payments.filter((p) => !docs.has(p.id)).map((p) => (p.kind === "payment" && p.vrNo) || "—")),
    statementsAsked,
  ].filter(Boolean).join(" ") || null;
  return { blocked, warning };
}

/** Where a book stands with the audit: whether it may be sent, whole or for a handover, and to whom it went. */
export async function auditStatus(
  financialYearId: string, auditSentTo: string | null,
  account: { id: string; type: string; authorisationExempt: boolean }, schoolId: string,
) {
  const periods = await db.select().from(schema.periods).where(eq(schema.periods.financialYearId, financialYearId));
  const [sentTo] = auditSentTo
    ? await db
      .select({ grant: schema.auditors, name: schema.users.name })
      .from(schema.auditors)
      .innerJoin(schema.users, eq(schema.users.id, schema.auditors.userId))
      .where(eq(schema.auditors.id, auditSentTo))
    : [];
  const handover = await latestHandover(schoolId);
  const cutoff = handover ? handoverCutoff(handover.handoverDate, periods) : null;
  return {
    yearClosed: yearClosed(periods),
    ...(await auditChecks(account, schoolId, financialYearId)),
    sentTo: sentTo ?? null,
    handover: handover && cutoff ? {
      ...handover,
      cutoff,
      cutoffName: monthName(`${cutoff}-01`),
      closed: closedThrough(periods, cutoff),
      ...(await auditChecks(account, schoolId, financialYearId, cutoff)),
    } : null,
  };
}
