import { describe, expect, it } from "vitest";
import {
  LOGIN_WINDOW_MINUTES, MAX_EMAIL_FAILURES, MAX_IP_FAILURES, loginBlocked,
} from "../login-throttle";

const now = new Date("2026-09-21T12:00:00Z");
const minutesAgo = (n: number) => new Date(now.getTime() - n * 60_000);
const times = (n: number, at: Date) => Array.from({ length: n }, () => at);

describe("loginBlocked", () => {
  it("lets a first attempt through", () => {
    expect(loginBlocked({ emailFailures: [], ipFailures: [], now }).blocked).toBe(false);
  });

  it("allows up to the limit before blocking", () => {
    const failures = times(MAX_EMAIL_FAILURES - 1, minutesAgo(1));
    expect(loginBlocked({ emailFailures: failures, ipFailures: [], now }).blocked).toBe(false);
  });

  it("blocks an account once the limit is reached", () => {
    const failures = times(MAX_EMAIL_FAILURES, minutesAgo(1));
    expect(loginBlocked({ emailFailures: failures, ipFailures: [], now }).blocked).toBe(true);
  });

  it("blocks an address hammering many accounts, even below the per-account limit", () => {
    // Spraying one password across many emails never trips the email counter.
    const failures = times(MAX_IP_FAILURES, minutesAgo(2));
    expect(loginBlocked({ emailFailures: [], ipFailures: failures, now }).blocked).toBe(true);
  });

  it("says how long to wait, counted from the oldest failure still in the window", () => {
    const failures = [minutesAgo(10), ...times(MAX_EMAIL_FAILURES - 1, minutesAgo(1))];
    const { blocked, retryAfterSeconds } = loginBlocked({
      emailFailures: failures, ipFailures: [], now,
    });
    expect(blocked).toBe(true);
    // The oldest lapses five minutes from now, which frees a slot.
    expect(retryAfterSeconds).toBe((LOGIN_WINDOW_MINUTES - 10) * 60);
  });

  it("forgets failures older than the window", () => {
    const stale = times(MAX_EMAIL_FAILURES + 5, minutesAgo(LOGIN_WINDOW_MINUTES + 1));
    expect(loginBlocked({ emailFailures: stale, ipFailures: [], now }).blocked).toBe(false);
  });

  it("never reports a negative or zero wait while blocked", () => {
    const failures = times(MAX_EMAIL_FAILURES, minutesAgo(LOGIN_WINDOW_MINUTES - 0.01));
    const { retryAfterSeconds } = loginBlocked({ emailFailures: failures, ipFailures: [], now });
    expect(retryAfterSeconds).toBeGreaterThan(0);
  });
});
