import "server-only";
import { notFound } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { auditorCanSee, type AuditScope } from "@/domain";
import { auditorScope, getCurrentUser } from "@/server/auth";

/**
 * The Ministry auditor's view. Like src/server/platform.ts this reads across
 * orgs, so every function starts with the grant check and there is no path in
 * that skips it.
 *
 * Nothing here writes to a book. The only write in this file is the log of
 * which school was opened.
 */
export async function requireAuditor() {
  const user = await getCurrentUser();
  if (!user) notFound();
  const scope = await auditorScope(user.id);
  if (!scope) notFound();
  return { user, scope };
}

export interface AuditableSchool {
  schoolId: string;
  schoolName: string;
  level: string;
  subCounty: string | null;
  orgId: string;
  orgName: string;
  books: { accountId: string; name: string }[];
  lastPostedAt: Date | null;
}

/** Every school in the auditor's area, whoever keeps its books. */
export async function schoolsInScope(scope: AuditScope): Promise<AuditableSchool[]> {
  const rows = await db
    .select({
      school: schema.schools,
      org: schema.orgs,
      account: schema.accounts,
    })
    .from(schema.schools)
    .innerJoin(schema.orgs, eq(schema.orgs.id, schema.schools.orgId))
    .leftJoin(schema.accounts, and(
      eq(schema.accounts.schoolId, schema.schools.id),
      isNull(schema.accounts.archivedAt),
    ))
    .orderBy(schema.schools.name);

  const by = new Map<string, AuditableSchool>();
  for (const r of rows) {
    // The scope decision is the domain's, not a SQL LIKE — see audit-scope.ts.
    if (!auditorCanSee(scope, r.school)) continue;
    const found = by.get(r.school.id) ?? {
      schoolId: r.school.id,
      schoolName: r.school.name,
      level: r.school.level,
      subCounty: r.school.subCounty,
      orgId: r.org.id,
      orgName: r.org.name,
      books: [],
      lastPostedAt: null,
    };
    if (r.account) found.books.push({ accountId: r.account.id, name: r.account.name });
    by.set(r.school.id, found);
  }
  return [...by.values()];
}

/**
 * Opens a school's books for reading, and records that it happened.
 *
 * The log entry is the point as much as the access is: a school should be
 * able to see who looked at its books and when, and an auditor is used to
 * leaving that trail.
 */
export async function beginAuditOf(schoolId: string) {
  const { user, scope } = await requireAuditor();

  const [row] = await db
    .select({ school: schema.schools, org: schema.orgs })
    .from(schema.schools)
    .innerJoin(schema.orgs, eq(schema.orgs.id, schema.schools.orgId))
    .where(eq(schema.schools.id, schoolId));
  if (!row || !auditorCanSee(scope, row.school)) notFound();

  await db.insert(schema.auditLog).values({
    orgId: row.org.id,
    userId: user.id,
    action: "audit.opened",
    entity: "school",
    entityId: row.school.id,
    before: null,
    after: JSON.stringify({
      school: row.school.name,
      county: scope.county,
      subCounty: scope.subCounty,
    }),
  });

  return row;
}

/** What an auditor has looked at, newest first — shown back to them. */
export async function auditTrail(userId: string) {
  return db
    .select({ row: schema.auditLog, orgName: schema.orgs.name })
    .from(schema.auditLog)
    .innerJoin(schema.orgs, eq(schema.orgs.id, schema.auditLog.orgId))
    .where(and(eq(schema.auditLog.userId, userId), eq(schema.auditLog.action, "audit.opened")))
    .orderBy(desc(schema.auditLog.at))
    .limit(25);
}

/**
 * The auditors who can currently read this org's books.
 *
 * Lives here rather than in platform.ts because a tenant page shows it, and
 * nothing under src/app/app/ may import the cross-tenant console module.
 * It reveals only who holds a grant over the org's own schools.
 */
export async function auditorsOverOrg(orgId: string) {
  const [grants, schools] = await Promise.all([
    db
      .select({ auditor: schema.auditors, name: schema.users.name, email: schema.users.email })
      .from(schema.auditors)
      .innerJoin(schema.users, eq(schema.users.id, schema.auditors.userId))
      .where(isNull(schema.auditors.revokedAt)),
    db.select().from(schema.schools).where(eq(schema.schools.orgId, orgId)),
  ]);

  return grants.filter((g) => schools.some((s) => auditorCanSee(g.auditor, s)));
}
