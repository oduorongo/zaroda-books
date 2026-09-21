import { describe, expect, it } from "vitest";
import { sessionIsUsable, shouldTouchSession } from "../session";

const now = new Date("2026-09-21T12:00:00Z");
const later = new Date("2026-10-21T12:00:00Z");
const earlier = new Date("2026-08-21T12:00:00Z");

describe("sessionIsUsable", () => {
  it("accepts a live session", () => {
    expect(sessionIsUsable({ expiresAt: later, revokedAt: null }, now)).toBe(true);
  });

  it("refuses an expired one", () => {
    expect(sessionIsUsable({ expiresAt: earlier, revokedAt: null }, now)).toBe(false);
  });

  it("refuses a revoked one, however fresh", () => {
    // This is the point of the table: signing out a lost phone must take
    // effect at once, not when the cookie happens to lapse.
    expect(sessionIsUsable({ expiresAt: later, revokedAt: earlier }, now)).toBe(false);
  });

  it("refuses at the exact moment of expiry", () => {
    expect(sessionIsUsable({ expiresAt: now, revokedAt: null }, now)).toBe(false);
  });

  it("refuses a session that is not there", () => {
    expect(sessionIsUsable(undefined, now)).toBe(false);
  });
});

describe("shouldTouchSession", () => {
  it("does not write on every page load", () => {
    // Recording "last seen" on each request is a database write per page.
    const minuteAgo = new Date(now.getTime() - 60_000);
    expect(shouldTouchSession(minuteAgo, now)).toBe(false);
  });

  it("writes once the record is an hour stale", () => {
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    expect(shouldTouchSession(twoHoursAgo, now)).toBe(true);
  });

  it("writes when nothing has been recorded yet", () => {
    expect(shouldTouchSession(null, now)).toBe(true);
  });
});
