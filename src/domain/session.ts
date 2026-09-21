/**
 * When a session may be used.
 *
 * Until now a session was a signed cookie and nothing else: it could not be
 * revoked, so a lost phone stayed signed in for thirty days and changing a
 * password did not shut anyone out. A row per session fixes that, and this is
 * the rule it turns on.
 */

export const SESSION_DAYS = 30;

/** An hour. Recording "last seen" on every request is a write per page load. */
const TOUCH_AFTER_MS = 60 * 60 * 1000;

export function sessionIsUsable(
  session: { expiresAt: Date; revokedAt: Date | null } | undefined,
  now: Date = new Date(),
): boolean {
  if (!session) return false;
  if (session.revokedAt) return false;
  // Not `<`: at the exact moment of expiry it has expired.
  return session.expiresAt.getTime() > now.getTime();
}

/**
 * Whether "last seen" is stale enough to be worth writing. Without this the
 * device list costs a database write on every page a bursar opens.
 */
export function shouldTouchSession(lastSeenAt: Date | null, now: Date = new Date()): boolean {
  if (!lastSeenAt) return true;
  return now.getTime() - lastSeenAt.getTime() > TOUCH_AFTER_MS;
}
