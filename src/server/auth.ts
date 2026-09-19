import "server-only";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

const COOKIE = "zb_session";
const VIEW_AS_COOKIE = "zb_view_as";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
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

export async function startSession(userId: string) {
  const expires = Date.now() + MAX_AGE_SECONDS * 1000;
  const payload = `${userId}.${expires}`;
  (await cookies()).set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

async function sessionUserId(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return null;
  const [userId, expires, signature] = raw.split(".");
  if (!userId || !expires || !signature) return null;

  const expected = Buffer.from(sign(`${userId}.${expires}`), "hex");
  const actual = Buffer.from(signature, "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  if (Number(expires) < Date.now()) return null;
  return userId;
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
}

/** The signed-in user and the org that scopes every query they may run. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const userId = await sessionUserId();
  if (!userId) return null;

  const [account] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  if (!account) return null;

  const viewing = await viewAsOrgId();
  if (viewing && (await isPlatformAdmin(userId))) {
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
      };
    }
  }

  const [membership] = await db
    .select()
    .from(schema.memberships)
    .where(eq(schema.memberships.userId, userId));
  if (!membership) return null;

  return {
    id: account.id,
    name: account.name,
    email: account.email,
    orgId: membership.orgId,
    role: membership.role,
    viewingAs: null,
    readOnly: false,
  };
}
