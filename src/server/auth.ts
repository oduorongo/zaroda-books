import "server-only";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

const COOKIE = "zb_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

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

/** The signed-in user and the org that scopes every query they may run. */
export async function getCurrentUser() {
  const userId = await sessionUserId();
  if (!userId) return null;

  const [row] = await db
    .select({ user: schema.users, membership: schema.memberships })
    .from(schema.users)
    .innerJoin(schema.memberships, eq(schema.memberships.userId, schema.users.id))
    .where(eq(schema.users.id, userId));
  if (!row) return null;

  return {
    id: row.user.id,
    name: row.user.name,
    email: row.user.email,
    orgId: row.membership.orgId,
    role: row.membership.role,
  };
}
