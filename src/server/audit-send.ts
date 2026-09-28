import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  auditBlockReason, auditorCanSee, missingDocumentsWarning, scdeAuditBlock, statementsAuditBlock, takesProject, yearClosed,
  type AccountType, type Placed,
} from "@/domain";
import { loadBook } from "@/server/book-context";
import { unauthorisedVouchers } from "@/server/authorisation";
import { documentsFor, monthsWithoutStatement, paymentsWithoutScde } from "@/server/documents";
import { monthName } from "@/server/periods";
import { getTxns } from "@/server/queries";
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

export async function sendForAudit(accountId: string, grantId: string) {
  const { user, fy, school, account } = await loadBook(accountId, { write: true, require: "book.sendForAudit" });

  const periods = await db.select().from(schema.periods).where(eq(schema.periods.financialYearId, fy.id));
  if (!yearClosed(periods)) throw new Error("Close the year, up to June, before sending the books for audit.");
  const { blocked } = await auditChecks(account, school.id, fy.id);
  if (blocked) throw new Error(blocked);

  const [chosen] = await db
    .select({ grant: schema.auditors, email: schema.users.email })
    .from(schema.auditors)
    .innerJoin(schema.users, eq(schema.users.id, schema.auditors.userId))
    .where(and(eq(schema.auditors.id, grantId), isNull(schema.auditors.revokedAt)));
  if (!chosen || !auditorCanSee(chosen.grant, school)) throw new Error("Choose an auditor who covers this school.");

  await db.batch([
    db.update(schema.accounts)
      .set({ auditSentTo: grantId, auditSentAt: new Date(), auditSentBy: user.id })
      .where(eq(schema.accounts.id, accountId)),
    db.insert(schema.auditLog).values({
      orgId: user.orgId, userId: user.id, action: "audit.sent", entity: "account", entityId: accountId,
      before: JSON.stringify({ auditSentTo: account.auditSentTo }),
      after: JSON.stringify({ auditSentTo: grantId, fy: fy.label }),
    }),
  ] as unknown as Parameters<typeof db.batch>[0]);

  const book = `${school.name} — ${account.name} ${fy.label}`;
  const url = `${SITE_URL}/audit`;
  try {
    await sendEmail({
      to: chosen.email,
      subject: `${school.name} has sent its books for audit`,
      html: emailLayout({
        heading: "Books sent for audit",
        body: `<strong>${book.replace(/</g, "&lt;")}</strong> has been closed and sent to you for audit.`,
        buttonLabel: "Open your audit list",
        buttonUrl: url,
        footer: "Sent by Zaroda Books because a school chose you as its auditor.",
      }),
      text: `${book} has been closed and sent to you for audit.\n\nOpen your audit list: ${url}`,
    });
  } catch {
    // sendEmail records its own problems; the books are sent either way.
  }
}

/** Where a book stands with the audit: whether it may be sent, and to whom it went. */
/**
 * What stops a book going for audit — payments the head has not authorised, and
 * infrastructure payments without an SCDE approval — and what only warns:
 * payments with no supporting documents. Exempt books predate all three.
 */
async function auditChecks(account: { id: string; type: string; authorisationExempt: boolean }, schoolId: string, fyId: string) {
  if (account.authorisationExempt) return { blocked: null, warning: null };
  const unauthorised = auditBlockReason(await unauthorisedVouchers(fyId));
  const scde = takesProject(account.type as AccountType)
    ? scdeAuditBlock(await paymentsWithoutScde(account.id, schoolId, fyId)) : null;
  const statements = statementsAuditBlock(
    (await monthsWithoutStatement(account.id, fyId)).map((m) => monthName(`${m}-01`)),
  );
  const blocked = [
    unauthorised && `${unauthorised} Have the head authorise them from Payments first.`,
    scde && `${scde} Attach the approvals under Projects.`,
    statements,
  ].filter(Boolean).join(" ") || null;

  const payments = (await getTxns(fyId)).filter((t) => t.kind === "payment");
  const docs = await documentsFor(payments.map((p) => p.id));
  const warning = missingDocumentsWarning(payments.filter((p) => !docs.has(p.id)).map((p) => (p.kind === "payment" && p.vrNo) || "—"));
  return { blocked, warning };
}

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
  return {
    yearClosed: yearClosed(periods),
    ...(await auditChecks(account, schoolId, financialYearId)),
    sentTo: sentTo ?? null,
  };
}
