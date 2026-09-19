import "server-only";
import { notFound } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { revenue, type SchoolLevel } from "@/domain";
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
  subscriptions: { level: SchoolLevel; fyLabel: string; paidAt: Date | null; isFree: boolean }[];
  lastPostedAt: Date | null;
}

export async function listTenants(): Promise<TenantRow[]> {
  await requirePlatformAdmin();

  const [orgs, owners, userCounts, schoolCounts, bookCounts, subs, activity] = await Promise.all([
    db.select().from(schema.orgs).orderBy(desc(schema.orgs.createdAt)),

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

  const [members, schools, books, subs, audit] = await Promise.all([
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
  ]);

  return { org, members, schools, books, subs, audit };
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

export async function setSubscriptionPaid(subscriptionId: string, paid: boolean) {
  const admin = await requirePlatformAdmin();

  const [before] = await db.select().from(schema.subscriptions)
    .where(eq(schema.subscriptions.id, subscriptionId));
  if (!before) notFound();

  const paidAt = paid ? new Date() : null;
  await db.update(schema.subscriptions).set({ paidAt })
    .where(eq(schema.subscriptions.id, subscriptionId));

  await record(before.orgId, admin.id, paid ? "subscription.paid" : "subscription.unpaid",
    subscriptionId, { paidAt: before.paidAt }, { paidAt });
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
