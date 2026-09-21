/**
 * How many password attempts are allowed, and for how long.
 *
 * There was no limit at all: a known email address could be guessed against
 * for ever. Two counters, because they catch different things — one address
 * hammered, and one attacker spraying a single password across many.
 */

export const LOGIN_WINDOW_MINUTES = 15;

/** Enough for someone genuinely misremembering; far short of useful guessing. */
export const MAX_EMAIL_FAILURES = 5;

/**
 * Higher, because a school or a cyber café shares one address and several
 * people may fumble a password in the same quarter of an hour.
 */
export const MAX_IP_FAILURES = 20;

export interface ThrottleDecision {
  blocked: boolean;
  /** Seconds until a slot frees, zero when not blocked. */
  retryAfterSeconds: number;
}

const WINDOW_MS = LOGIN_WINDOW_MINUTES * 60 * 1000;

export function loginBlocked(input: {
  emailFailures: Date[];
  ipFailures: Date[];
  now?: Date;
}): ThrottleDecision {
  const now = input.now ?? new Date();
  const since = now.getTime() - WINDOW_MS;
  const recent = (ds: Date[]) => ds.filter((d) => d.getTime() > since).sort((a, b) => +a - +b);

  const email = recent(input.emailFailures);
  const ip = recent(input.ipFailures);

  const overEmail = email.length >= MAX_EMAIL_FAILURES;
  const overIp = ip.length >= MAX_IP_FAILURES;
  if (!overEmail && !overIp) return { blocked: false, retryAfterSeconds: 0 };

  // A slot frees when the oldest failure still counting drops out of the
  // window, so that is what the wait is measured to.
  const oldest = Math.min(
    ...(overEmail ? [email[0].getTime()] : []),
    ...(overIp ? [ip[0].getTime()] : []),
  );
  const seconds = Math.ceil((oldest + WINDOW_MS - now.getTime()) / 1000);
  return { blocked: true, retryAfterSeconds: Math.max(seconds, 1) };
}

/** "in 4 minutes" / "in 30 seconds", for telling somebody who is locked out. */
export function describeWait(seconds: number): string {
  if (seconds < 60) return `in ${seconds} second${seconds === 1 ? "" : "s"}`;
  const minutes = Math.ceil(seconds / 60);
  return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
}
