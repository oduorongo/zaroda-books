/**
 * Where an email actually goes.
 *
 * EMAIL_REDIRECT_TO sends every message to one address instead of the person
 * it names. Two reasons to want that: Resend will only deliver to your own
 * account address until a sending domain is verified, and it is the only way
 * to see what the system sends without mailing real schools.
 *
 * It is dangerous left on. A tenant's password reset link would arrive in
 * somebody else's inbox — a working key to their books. So the diversion is
 * always reported back, the message says who it was meant for, and the owner
 * console shows a warning while it is set.
 */

export interface Recipient {
  to: string;
  /** Who it was meant for, when it has been diverted. Null when it has not. */
  redirectedFrom: string | null;
}

const clean = (s: string) => s.trim().toLowerCase();
const looksLikeAddress = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

export function resolveRecipient(intended: string, override: string | undefined): Recipient {
  const to = override?.trim() ?? "";
  // A typo in an environment variable must not quietly swallow the mail.
  if (!to || !looksLikeAddress(to)) return { to: intended, redirectedFrom: null };
  if (clean(to) === clean(intended)) return { to, redirectedFrom: null };
  return { to, redirectedFrom: intended };
}
