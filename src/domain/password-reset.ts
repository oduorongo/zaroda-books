/**
 * The rules a password reset turns on. Pure, so the decision that stands
 * between a stranger and somebody's books is tested without a database.
 */

export const MIN_PASSWORD = 10;

/**
 * A reset link is usable once, briefly. It sits in an inbox afterwards, and
 * an inbox is not a safe place for a standing key to a school's accounts.
 */
export function resetIsUsable(
  reset: { expiresAt: Date; usedAt: Date | null } | undefined,
  now: Date = new Date(),
): boolean {
  if (!reset) return false;
  if (reset.usedAt) return false;
  // Not `<`: at the exact moment of expiry it has expired.
  return reset.expiresAt.getTime() > now.getTime();
}

/** The one thing wrong with a new password, or null. Length first: it is the
 *  advice worth giving when both are wrong. */
export function passwordProblem(password: string, again: string): string | null {
  if (password.length < MIN_PASSWORD) {
    return `The password must be at least ${MIN_PASSWORD} characters.`;
  }
  if (password !== again) return "The two passwords do not match.";
  return null;
}
