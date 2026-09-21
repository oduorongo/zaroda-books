import "server-only";
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { db, schema } from "@/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { AuditScope, BookScope } from "@/domain";
import { SESSION_DAYS, chooseMembership, sessionIsUsable, shouldTouchSession } from "@/domain";

const COOKIE = "zb_session";
const VIEW_AS_COOKIE = "zb_view_as";
/** Which books, for somebody who belongs to more than one set. */
const ORG_COOKIE = "zb_org";
const VIEW_AS_MAX_AGE_SECONDS = 60 * 60 * 2;

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set.");
  return s;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(expected, actual);
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("hex");

/**
 * SHA-256, not scrypt: the token is 32 random bytes we chose, so there is
 * nothing to brute force and no reason to verify it slowly on every page.
 */
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Opens a session: a random token in the cookie, its hash in the database.
 * Storing the hash means a leaked database cannot be used to impersonate
 * anyone, and the row is what makes the session revocable.
 */
export async function startSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  const h = await headers();
  await db.insert(schema.sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
    lastSeenAt: new Date(),
    userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}
/** Signing out revokes the row too, so the cookie cannot be replayed. */
export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await db.update(schema.sessions).set({ revokedAt: new Date() })
      .where(eq(schema.sessions.tokenHash, hashToken(token)));
  }
  jar.delete(COOKIE);
}
async function sessionUserId(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const [session] = await db.select().from(schema.sessions)
    .where(eq(schema.sessions.tokenHash, hashToken(token)));
  if (!sessionIsUsable(session)) return null;

  // Kept roughly current rather than exactly: see shouldTouchSession.
  if (shouldTouchSession(session.lastSeenAt)) {
    await db.update(schema.sessions).set({ lastSeenAt: new Date() })
      .where(eq(schema.sessions.id, session.id));
  }
  return session.userId;
}

/** Every session but this one — or every one, when no token is given. */
export async function revokeSessions(userId: string, exceptToken?: string) {
  const rows = await db.select().from(schema.sessions)
    .where(and(eq(schema.sessions.userId, userId), isNull(schema.sessions.revokedAt)));
  const keep = exceptToken ? hashToken(exceptToken) : null;
  for (const row of rows) {
    if (row.tokenHash === keep) continue;
    await db.update(schema.sessions).set({ revokedAt: new Date() })
      .where(eq(schema.sessions.id, row.id));
  }
}

/** The devices a person is signed in on, newest first. */
export async function listSessions(userId: string) {
  const token = (await cookies()).get(COOKIE)?.value;
  const current = token ? hashToken(token) : null;
  const rows = await db.select().from(schema.sessions)
    .where(and(eq(schema.sessions.userId, userId), isNull(schema.sessions.revokedAt)))
    .orderBy(desc(schema.sessions.createdAt));
  return rows
    .filter((r) => sessionIsUsable(r))
    .map((r) => ({ ...r, isCurrent: r.tokenHash === current }));
}

export async function revokeSession(userId: string, sessionId: string) {
  await db.update(schema.sessions).set({ revokedAt: new Date() })
    .where(and(eq(schema.sessions.id, sessionId), eq(schema.sessions.userId, userId)));
}
/** Is this user Zaroda Solutions? Read from the table, never from a cookie. */
export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: schema.platformAdmins.id })
    .from(schema.platformAdmins)
    .where(eq(schema.platformAdmins.userId, userId));
  return Boolean(row);
}

/**
 * Look at a tenant's books as the system owner. The org is signed into a second,
 * short-lived cookie, and is honoured only for a user still in `platform_admins`
 * at the moment it is read — so withdrawing the grant ends every view in
 * progress instead of waiting for the cookie to lapse.
 */
export async function startViewAs(orgId: string) {
  const expires = Date.now() + VIEW_AS_MAX_AGE_SECONDS * 1000;
  const payload = `${orgId}.${expires}`;
  (await cookies()).set(VIEW_AS_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VIEW_AS_MAX_AGE_SECONDS,
  });
}

export async function endViewAs() {
  (await cookies()).delete(VIEW_AS_COOKIE);
}

async function viewAsOrgId(): Promise<string | null> {
  const raw = (await cookies()).get(VIEW_AS_COOKIE)?.value;
  if (!raw) return null;
  const [orgId, expires, signature] = raw.split(".");
  if (!orgId || !expires || !signature) return null;

  const expected = Buffer.from(sign(`${orgId}.${expires}`), "hex");
  const actual = Buffer.from(signature, "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  if (Number(expires) < Date.now()) return null;
  return orgId;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  orgId: string;
  role: "owner" | "accountant" | "bursar" | "viewer";
  /** Set while a system owner is looking at another org's books. */
  viewingAs: { orgId: string; orgName: string } | null;
  /** A view-as session may read every book and write to none of them. */
  readOnly: boolean;
  /**
   * Which schools inside the org this session may reach. Org-wide for a
   * member of the practice, one school for someone tied to it, an area for a
   * Ministry auditor. Tenancy is checked first; this only ever narrows.
   */
  bookScope: BookScope;
  /** True while a Ministry auditor is reading, for wording and for logging. */
  auditing: boolean;
}

/** The signed-in user and the org that scopes every query they may run. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const userId = await sessionUserId();
  if (!userId) return null;

  const [account] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  if (!account) return null;

  const viewing = await viewAsOrgId();
  if (viewing) {
    // Re-checked on every read rather than trusted from the cookie, so
    // withdrawing a grant ends any session already in progress.
    const [admin, scope] = await Promise.all([
      isPlatformAdmin(userId),
      auditorScope(userId),
    ]);
    if (admin || scope) {
      const [org] = await db.select().from(schema.orgs).where(eq(schema.orgs.id, viewing));
      if (org) {
        return {
          id: account.id,
          name: account.name,
          email: account.email,
          orgId: org.id,
          role: "viewer",
          viewingAs: { orgId: org.id, orgName: org.name },
          readOnly: true,
          // A platform admin sees the whole org; an auditor only their area.
          bookScope: admin || !scope
            ? { kind: "org" }
            : { kind: "area", county: scope.county, subCounty: scope.subCounty },
          auditing: !admin && Boolean(scope),
        };
      }
    }
  }

  const memberships = await db
    .select()
    .from(schema.memberships)
    .where(eq(schema.memberships.userId, userId));

  // A freelancer may keep their own practice and also be invited to a school.
  // The cookie only selects among what they already hold — see choose-org.ts.
  const membership = chooseMembership(memberships, (await cookies()).get(ORG_COOKIE)?.value);
  if (!membership) return null;

  return {
    id: account.id,
    name: account.name,
    email: account.email,
    orgId: membership.orgId,
    role: membership.role,
    viewingAs: null,
    readOnly: false,
    bookScope: membership.schoolId
      ? { kind: "school", schoolId: membership.schoolId }
      : { kind: "org" },
    auditing: false,
  };
}

/** The live audit grant for a user, or null. Revoked grants never count. */
export async function auditorScope(userId: string): Promise<AuditScope | null> {
  const [row] = await db
    .select({ county: schema.auditors.county, subCounty: schema.auditors.subCounty })
    .from(schema.auditors)
    .where(and(eq(schema.auditors.userId, userId), isNull(schema.auditors.revokedAt)));
  return row ?? null;
}

/** Every set of books this person belongs to, for the switcher. */
export async function myOrgs(userId: string) {
  return db
    .select({ orgId: schema.orgs.id, name: schema.orgs.name, role: schema.memberships.role })
    .from(schema.memberships)
    .innerJoin(schema.orgs, eq(schema.orgs.id, schema.memberships.orgId))
    .where(eq(schema.memberships.userId, userId))
    .orderBy(schema.memberships.createdAt);
}

/**
 * Remembers which books to open. Not a grant: getCurrentUser only honours
 * it if the person is a member, so setting it to anything else does nothing.
 */
export async function chooseOrg(orgId: string) {
  (await cookies()).set(ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}