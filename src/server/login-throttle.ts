import "server-only";
import { and, eq, gt, lt, or } from "drizzle-orm";
import { db, schema } from "@/db";
import { LOGIN_WINDOW_MINUTES, loginBlocked } from "@/domain";

/**
 * The throttle, kept in the database rather than in memory.
 *
 * On Vercel each request may be served by a different instance, so an
 * in-memory counter would reset constantly and stop nothing. This costs one
 * query per login attempt, which is the right trade for the only endpoint
 * where guessing pays.
 */

const windowStart = () => new Date(Date.now() - LOGIN_WINDOW_MINUTES * 60 * 1000);

export async function checkLoginAllowed(email: string, ip: string | null) {
  const since = windowStart();

  const rows = await db
    .select({ email: schema.loginFailures.email, ip: schema.loginFailures.ip, at: schema.loginFailures.at })
    .from(schema.loginFailures)
    .where(and(
      gt(schema.loginFailures.at, since),
      ip
        ? or(eq(schema.loginFailures.email, email), eq(schema.loginFailures.ip, ip))
        : eq(schema.loginFailures.email, email),
    ));

  return loginBlocked({
    emailFailures: rows.filter((r) => r.email === email).map((r) => r.at),
    ipFailures: ip ? rows.filter((r) => r.ip === ip).map((r) => r.at) : [],
  });
}

export async function recordLoginFailure(email: string, ip: string | null) {
  await db.insert(schema.loginFailures).values({ email, ip });

  // Swept here rather than on a schedule: there is no cron, and the table is
  // only ever read for the last fifteen minutes.
  await db.delete(schema.loginFailures).where(lt(schema.loginFailures.at, windowStart()));
}

/** A good password clears the slate, so one bad afternoon is not punished. */
export async function clearLoginFailures(email: string) {
  await db.delete(schema.loginFailures).where(eq(schema.loginFailures.email, email));
}

/**
 * The same counters applied to password-reset requests, under their own key
 * so a burst of reset emails does not lock somebody out of logging in.
 *
 * Without this an address can be bombed with reset mail — a nuisance to them
 * and a bill to us.
 */
const resetKey = (email: string) => `reset:${email}`;

export async function checkResetAllowed(email: string, ip: string | null) {
  return checkLoginAllowed(resetKey(email), ip);
}

export async function recordResetRequest(email: string, ip: string | null) {
  await recordLoginFailure(resetKey(email), ip);
}
