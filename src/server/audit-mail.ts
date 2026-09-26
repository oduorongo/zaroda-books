import "server-only";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { emailLayout, sendEmail } from "@/server/email";
import { SITE_URL } from "@/app/site-url";

/**
 * Email between a school and its auditor. Every step either side takes on the
 * other's behalf is sent to them, so neither has to keep checking.
 *
 * Never throws: an audit step must not fail because an email did.
 */
export async function auditMail(to: string[], input: {
  subject: string;
  heading: string;
  /** HTML. Anything a person typed must go through `escapeHtml` first. */
  body: string;
  buttonLabel: string;
  linkPath: string;
}) {
  const url = `${SITE_URL}${input.linkPath}`;
  for (const address of to) {
    try {
      await sendEmail({
        to: address,
        subject: input.subject,
        html: emailLayout({
          heading: input.heading,
          body: input.body,
          buttonLabel: input.buttonLabel,
          buttonUrl: url,
          footer: "Sent by Zaroda Books because this audit concerns you.",
        }),
        text: `${input.body.replace(/<br>/g, "\n").replace(/<[^>]+>/g, "")}\n\n${input.buttonLabel}: ${url}`,
      });
    } catch {
      // sendEmail records its own problems.
    }
  }
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Who hears from the auditor on a school's behalf: its owners and accountants —
 * those across the practice, and those tied to this school. Someone tied to a
 * different school of the same practice hears nothing about this one.
 */
export async function schoolContacts(orgId: string, schoolId: string) {
  const rows = await db
    .selectDistinct({ email: schema.users.email })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
    .where(and(
      eq(schema.memberships.orgId, orgId),
      inArray(schema.memberships.role, ["owner", "accountant"]),
      or(isNull(schema.memberships.schoolId), eq(schema.memberships.schoolId, schoolId)),
    ));
  return rows.map((r) => r.email);
}

/** The auditor holding a grant. */
export async function auditorEmail(grantId: string) {
  const [row] = await db
    .select({ email: schema.users.email })
    .from(schema.auditors)
    .innerJoin(schema.users, eq(schema.users.id, schema.auditors.userId))
    .where(eq(schema.auditors.id, grantId));
  return row ? [row.email] : [];
}
