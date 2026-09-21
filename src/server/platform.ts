import "server-only";
import { notFound } from "next/navigation";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import {
  LEVEL_PRICE, auditorCanSee, chargeAmount, revenue, subscriptionStateFor,
  type SchoolLevel, type SubscriptionStatus,
} from "@/domain";

export type { SubscriptionStatus };
import { tumaCallbackUrl } from "@/server/tuma";
import { emailConfigured, emailRedirectedTo } from "@/server/email";
import { getCurrentUser, isPlatformAdmin } from "@/server/auth";

/**
 * The only module that reads across orgs. Every function here begins with the
 * platform-admin check, so there is no path into cross-tenant data that skips
 * it. Nothing under src/app/app/ may import from this file.
 */
export async function requirePlatformAdmin() {
  const user = await getCurrentUser();
  // Someone in a view-as session is acting as a tenant, so they are refused here
  // too: end the view first and the console comes back.
  if (!user || user.viewingAs || !(await isPlatformAdmin(user.id))) notFound();
  return user;
}

const countOf = sql<number>`cast(count(*) as int)`;

export interface TenantRow {
  orgId: string;
  orgName: string;
  createdAt: Date;
  ownerName: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  users: number;
  schools: number;
  books: number;
  approvedAt: Date | null;
  subscriptions: { level: SchoolLevel; fyLabel: string; paidAt: Date | null; isFree: boolean }[];
  lastPostedAt: Date | null;
}

export async function listTenants(): Promise<TenantRow[]> {
  await requirePlatformAdmin();

  const [orgs, owners, userCounts, schoolCounts, bookCounts, subs, activity] = await Promise.all([
    // Pending first: an org waiting on review is the one thing here that needs
    // acting on today.
    db.select().from(schema.orgs)
      .orderBy(sql`${schema.orgs.approvedAt} is not null`, desc(schema.orgs.createdAt)),

    db
      .select({
        orgId: schema.memberships.orgId,
        name: schema.users.name,
        email: schema.users.email,
        phone: schema.users.phone,
      })
      .from(schema.memberships)
      .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
      .where(eq(schema.memberships.role, "owner")),

    db
      .select({ orgId: schema.memberships.orgId, n: countOf })
      .from(schema.memberships)
      .groupBy(schema.memberships.orgId),

    db
      .select({ orgId: schema.schools.orgId, n: countOf })
      .from(schema.schools)
      .groupBy(schema.schools.orgId),

    db
      .select({ orgId: schema.schools.orgId, n: countOf })
      .from(schema.accounts)
      .innerJoin(schema.schools, eq(schema.schools.id, schema.accounts.schoolId))
      .groupBy(schema.schools.orgId),

    db.select().from(schema.subscriptions),

    db
      .select({
        orgId: schema.schools.orgId,
        at: sql<string | null>`max(${schema.transactions.createdAt})`,
      })
      .from(schema.transactions)
      .innerJoin(schema.periods, eq(schema.periods.id, schema.transactions.periodId))
      .innerJoin(schema.financialYears, eq(schema.financialYears.id, schema.periods.financialYearId))
      .innerJoin(schema.accounts, eq(schema.accounts.id, schema.financialYears.accountId))
      .innerJoin(schema.schools, eq(schema.schools.id, schema.accounts.schoolId))
      .groupBy(schema.schools.orgId),
  ]);

  const by = <T extends { orgId: string }>(rows: T[]) => new Map(rows.map((r) => [r.orgId, r]));
  const ownerBy = by(owners);
  const usersBy = by(userCounts);
  const schoolsBy = by(schoolCounts);
  const booksBy = by(bookCounts);
  const activityBy = by(activity);

  return orgs.map((org) => {
    const at = activityBy.get(org.id)?.at ?? null;
    return {
      orgId: org.id,
      orgName: org.name,
      createdAt: org.createdAt,
      ownerName: ownerBy.get(org.id)?.name ?? null,
      ownerEmail: ownerBy.get(org.id)?.email ?? null,
      ownerPhone: ownerBy.get(org.id)?.phone ?? null,
      users: usersBy.get(org.id)?.n ?? 0,
      schools: schoolsBy.get(org.id)?.n ?? 0,
      books: booksBy.get(org.id)?.n ?? 0,
      approvedAt: org.approvedAt,
      subscriptions: subs
        .filter((s) => s.orgId === org.id)
        .map((s) => ({ level: s.level, fyLabel: s.fyLabel, paidAt: s.paidAt, isFree: s.isFree })),
      lastPostedAt: at ? new Date(at) : null,
    };
  });
}

export function platformTotals(tenants: TenantRow[]) {
  return {
    orgs: tenants.length,
    users: tenants.reduce((a, t) => a + t.users, 0),
    schools: tenants.reduce((a, t) => a + t.schools, 0),
    books: tenants.reduce((a, t) => a + t.books, 0),
    ...revenue(tenants.flatMap((t) => t.subscriptions)),
  };
}

export async function getTenant(orgId: string) {
  await requirePlatformAdmin();

  const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.id, orgId));
  if (!org) notFound();

  const [members, schools, books, subs, audit, payments] = await Promise.all([
    db
      .select({ user: schema.users, role: schema.memberships.role })
      .from(schema.memberships)
      .innerJoin(schema.users, eq(schema.users.id, schema.memberships.userId))
      .where(eq(schema.memberships.orgId, orgId)),

    db.select().from(schema.schools)
      .where(eq(schema.schools.orgId, orgId))
      .orderBy(schema.schools.name),

    db
      .select({ account: schema.accounts, school: schema.schools })
      .from(schema.accounts)
      .innerJoin(schema.schools, eq(schema.schools.id, schema.accounts.schoolId))
      .where(eq(schema.schools.orgId, orgId))
      .orderBy(schema.schools.name, schema.accounts.name),

    db
      .select({ subscription: schema.subscriptions, school: schema.schools })
      .from(schema.subscriptions)
      .leftJoin(schema.schools, eq(schema.schools.id, schema.subscriptions.schoolId))
      .where(eq(schema.subscriptions.orgId, orgId))
      .orderBy(desc(schema.subscriptions.fyLabel)),

    db
      .select({ row: schema.auditLog, userName: schema.users.name })
      .from(schema.auditLog)
      .leftJoin(schema.users, eq(schema.users.id, schema.auditLog.userId))
      .where(eq(schema.auditLog.orgId, orgId))
      .orderBy(desc(schema.auditLog.at))
      .limit(50),

    db
      .select()
      .from(schema.subscriptionPayments)
      .where(eq(schema.subscriptionPayments.orgId, orgId))
      .orderBy(desc(schema.subscriptionPayments.createdAt))
      .limit(50),
  ]);

  return { org, members, schools, books, subs, audit, payments };
}

/** Every write the console makes goes through here, so none of them is unlogged. */
async function record(
  orgId: string,
  userId: string,
  action: string,
  entityId: string,
  before: unknown,
  after: unknown,
) {
  await db.insert(schema.auditLog).values({
    orgId,
    userId,
    action,
    entity: "subscription",
    entityId,
    before: JSON.stringify(before),
    after: JSON.stringify(after),
  });
}

/**
 * Sets a subscription to any of its three states, including turning one into
 * the org's free school or taking that away.
 *
 * Granting free here is the only way an org gets a second free school, so it
 * is a deliberate act by Zaroda rather than anything a tenant can reach, and
 * both directions are written to the log.
 */
export async function setSubscriptionStatus(
  subscriptionId: string,
  status: SubscriptionStatus,
) {
  const admin = await requirePlatformAdmin();

  const [before] = await db.select().from(schema.subscriptions)
    .where(eq(schema.subscriptions.id, subscriptionId));
  if (!before) notFound();

  const next = subscriptionStateFor(status, before);

  await db.update(schema.subscriptions).set(next)
    .where(eq(schema.subscriptions.id, subscriptionId));

  await record(before.orgId, admin.id, `subscription.${status}`, subscriptionId,
    { paidAt: before.paidAt, isFree: before.isFree }, next);
}

export async function createSubscription(
  orgId: string, level: SchoolLevel, fyLabel: string, paid: boolean,
) {
  const admin = await requirePlatformAdmin();

  const [existing] = await db.select().from(schema.subscriptions).where(and(
    eq(schema.subscriptions.orgId, orgId),
    eq(schema.subscriptions.level, level),
    eq(schema.subscriptions.fyLabel, fyLabel),
  ));
  if (existing) throw new Error("That org already has a subscription for this level and year.");

  const [created] = await db.insert(schema.subscriptions)
    .values({ orgId, level, fyLabel, paidAt: paid ? new Date() : null })
    .returning();

  await record(orgId, admin.id, "subscription.created", created.id, null,
    { level, fyLabel, paidAt: created.paidAt });
  return created;
}

/**
 * Release a subscription from the school it was bound to. The binding is what
 * stops one payment serving a second school (src/domain/subscription.ts), so
 * this is here only for a binding made in error: it demands a reason, and the
 * reason and the school released are both written to the audit log.
 */
export async function unbindSubscription(subscriptionId: string, reason: string) {
  const admin = await requirePlatformAdmin();
  if (reason.trim().length < 15) {
    throw new Error("Give the reason for releasing this binding, in a sentence.");
  }

  const [before] = await db.select().from(schema.subscriptions)
    .where(eq(schema.subscriptions.id, subscriptionId));
  if (!before) notFound();
  if (!before.schoolId) throw new Error("That subscription is not bound to a school.");

  await db.update(schema.subscriptions).set({ schoolId: null, boundAt: null })
    .where(eq(schema.subscriptions.id, subscriptionId));

  await record(before.orgId, admin.id, "subscription.unbound", subscriptionId,
    { schoolId: before.schoolId, boundAt: before.boundAt },
    { schoolId: null, reason: reason.trim() });
}

/**
 * Releases a tenant's free school, or holds it back again. Approval is how a
 * second free account is caught, so both directions are written to the log.
 */
export async function setOrgApproved(orgId: string, approved: boolean) {
  const admin = await requirePlatformAdmin();

  const [before] = await db.select().from(schema.orgs).where(eq(schema.orgs.id, orgId));
  if (!before) notFound();

  const approvedAt = approved ? new Date() : null;
  await db.update(schema.orgs)
    .set({ approvedAt, approvedBy: approved ? admin.id : null })
    .where(eq(schema.orgs.id, orgId));

  await db.insert(schema.auditLog).values({
    orgId,
    userId: admin.id,
    action: approved ? "org.approved" : "org.unapproved",
    entity: "org",
    entityId: orgId,
    before: JSON.stringify({ approvedAt: before.approvedAt }),
    after: JSON.stringify({ approvedAt }),
  });
}

export interface CoverageRow {
  county: string;
  orgs: number;
  schools: number;
  subCounties: string[];
}

/**
 * Where Zaroda Books is actually being used. Counted from the schools, not
 * from the subscribers: a book keeper in Nairobi with thirty schools in Kisii
 * is coverage of Kisii, and counting their own county would say otherwise.
 */
export async function coverage(): Promise<{
  rows: CoverageRow[];
  schoolsPlaced: number;
  schoolsUnplaced: number;
  countiesReached: number;
}> {
  await requirePlatformAdmin();

  const [schools, orgs] = await Promise.all([
    db
      .select({ county: schema.schools.county, subCounty: schema.schools.subCounty })
      .from(schema.schools),
    db.select({ county: schema.orgs.county }).from(schema.orgs),
  ]);

  const byCounty = new Map<string, CoverageRow>();
  const row = (county: string) => {
    const found = byCounty.get(county)
      ?? { county, orgs: 0, schools: 0, subCounties: [] as string[] };
    byCounty.set(county, found);
    return found;
  };

  for (const s of schools) {
    if (!s.county) continue;
    const r = row(s.county);
    r.schools += 1;
    if (s.subCounty && !r.subCounties.includes(s.subCounty)) r.subCounties.push(s.subCounty);
  }
  for (const o of orgs) {
    if (o.county) row(o.county).orgs += 1;
  }

  const rows = [...byCounty.values()].sort((a, b) => b.schools - a.schools || a.county.localeCompare(b.county));
  const schoolsPlaced = schools.filter((s) => s.county).length;

  return {
    rows,
    schoolsPlaced,
    schoolsUnplaced: schools.length - schoolsPlaced,
    countiesReached: rows.filter((r) => r.schools > 0).length,
  };
}

/**
 * What the running server actually sees of the payment configuration. Reading
 * it from production is the only reliable way to tell a code problem from an
 * environment one — a variable can be present in the Vercel dashboard and
 * still not reach the build, or carry stray quotes that make it unusable.
 */
export async function gatewayStatus() {
  await requirePlatformAdmin();

  const raw = process.env.TUMA_TEST_AMOUNT_KES;
  const { cents, isTest } = chargeAmount(LEVEL_PRICE.primary, raw);
  const key = process.env.TUMA_API_KEY;

  return {
    email: process.env.TUMA_EMAIL ?? null,
    keyPresent: Boolean(key),
    keyLength: key?.length ?? 0,
    keyEnds: key ? key.slice(-4) : null,
    testAmountRaw: raw === undefined ? null : JSON.stringify(raw),
    testAmountApplies: isTest,
    primaryWouldCharge: cents,
    callbackUrl: tumaCallbackUrl(),
    emailFrom: process.env.RESEND_FROM ?? null,
    emailConfigured: emailConfigured(),
    emailRedirectedTo: emailRedirectedTo(),
    notifyEmail: process.env.ADMIN_NOTIFY_EMAIL?.trim() || null,
  };
}

/** Every audit grant, live and withdrawn, for the owner console. */
export async function listAuditors() {
  await requirePlatformAdmin();
  return db
    .select({
      auditor: schema.auditors,
      name: schema.users.name,
      email: schema.users.email,
    })
    .from(schema.auditors)
    .innerJoin(schema.users, eq(schema.users.id, schema.auditors.userId))
    .orderBy(desc(schema.auditors.grantedAt));
}

/**
 * Grants an existing account the audit of one area. The person must already
 * have signed up: creating a login here would mean choosing a password for
 * someone, and nobody should hold a credential they did not set.
 */
export async function grantAuditor(email: string, county: string, subCounty: string | null) {
  const admin = await requirePlatformAdmin();

  const [user] = await db.select().from(schema.users)
    .where(eq(schema.users.email, email.trim().toLowerCase()));
  if (!user) {
    throw new Error("No account with that email. Ask the auditor to sign up first, then grant it.");
  }

  const [live] = await db.select().from(schema.auditors).where(and(
    eq(schema.auditors.userId, user.id),
    isNull(schema.auditors.revokedAt),
  ));
  if (live) throw new Error("That account already holds an audit grant. Withdraw it first.");

  await db.insert(schema.auditors).values({
    userId: user.id, county, subCounty, grantedBy: admin.id,
  });
}

/** Withdrawn, not deleted: who could read a school's books is itself auditable. */
export async function revokeAuditor(auditorId: string) {
  await requirePlatformAdmin();
  await db.update(schema.auditors).set({ revokedAt: new Date() })
    .where(eq(schema.auditors.id, auditorId));
}
